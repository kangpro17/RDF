// Embedded TTL Data (to bypass CORS issues when running locally via file://)
const embeddedTTL = `
@prefix ex: <http://example.org/fable/ant-grasshopper/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

# 이야기 정의
ex:AntAndGrasshopper rdf:type ex:Story ;
    rdfs:label "개미와 배짱이" ;
    ex:hasCharacter ex:Ant , ex:Grasshopper ;
    ex:hasEvent ex:SummerEvent , ex:WinterEvent ;
    ex:hasMoral ex:MoralLesson .

# 관계(속성) 정의
ex:hasCharacter rdfs:label "등장인물" .
ex:hasEvent rdfs:label "사건" .
ex:hasTrait rdfs:label "특징" .
ex:hasOutcome rdfs:label "결과" .
ex:hasMoral rdfs:label "교훈" .
rdf:type rdfs:label "종류" .

# 등장인물 정의
ex:Ant rdf:type ex:Character ;
    rdfs:label "개미" ;
    ex:hasTrait "부지런함" .

ex:Grasshopper rdf:type ex:Character ;
    rdfs:label "베짱이" ;
    ex:hasTrait "노래함" .

# 사건 및 결과 정의
ex:SummerEvent rdf:type ex:Event ;
    rdfs:label "여름" ;
    ex:hasOutcome "식량을 비축함" .

ex:WinterEvent rdf:type ex:Event ;
    rdfs:label "겨울" ;
    ex:hasOutcome ex:AntSuccess , ex:GrasshopperHardship .

ex:AntSuccess rdf:type ex:Outcome ;
    rdfs:label "따뜻하게 보냄" .

ex:GrasshopperHardship rdf:type ex:Outcome ;
    rdfs:label "배고픔에 시달림" .

# 교훈 정의
ex:MoralLesson rdf:type ex:Moral ;
    rdfs:label "미리 준비하는 사람이 어려움을 이긴다" .
`;

// Global objects
let network;
let nodes;
let edges;
let store = new N3.Store();
const { DataFactory } = N3;
const { namedNode } = DataFactory;

// Namespaces
const EX = 'http://example.org/fable/ant-grasshopper/';
const RDFS = 'http://www.w3.org/2000/01/rdf-schema#';
const SCHEMA = 'https://schema.org/';

async function init() {
  // We use the embedded data directly to avoid CORS issues with local files
  const parser = new N3.Parser();

  parser.parse(embeddedTTL, (error, quad) => {
    if (error) {
      console.error("Parsing error:", error);
      return;
    }
    if (quad) {
      store.addQuad(quad);
    } else {
      visualize();
    }
  });
}

function getNodeColor(uri) {
  const typeQuads = store.getQuads(namedNode(uri), namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), null, null);
  let type = "";
  if (typeQuads.length > 0) {
    type = typeQuads[0].object.value.toLowerCase();
  }

  if (type.includes('character')) return '#fbbf24';
  if (type.includes('scene')) return '#60a5fa';
  if (type.includes('movie') || type.includes('schema')) return '#f87171';
  return '#94a3b8';
}

function getLabel(term) {
  if (term.termType === 'Literal') return term.value;
  if (term.termType === 'NamedNode') {
    const labels = store.getQuads(term, namedNode(RDFS + 'label'), null, null);
    if (labels.length > 0) return labels[0].object.value;
    const names = store.getQuads(term, namedNode(SCHEMA + 'name'), null, null);
    if (names.length > 0) return names[0].object.value;

    const parts = term.value.split(/[\/#]/);
    return parts[parts.length - 1];
  }
  return term.value;
}

function visualize() {
  nodes = new vis.DataSet();
  edges = new vis.DataSet();
  const addedNodes = new Set();

  store.forEach(quad => {
    const subj = quad.subject;
    const pred = quad.predicate;
    const obj = quad.object;

    [subj, obj].forEach(term => {
      if (!addedNodes.has(term.value)) {
        let color = '#94a3b8';
        let shape = 'dot';
        let fontColor = '#c9d1d9';
        let size = 20;

        if (term.termType === 'Literal') {
          color = '#a78bfa';
          shape = 'box';
          size = 15;
        } else {
          color = getNodeColor(term.value);
        }

        nodes.add({
          id: term.value,
          label: getLabel(term),
          color: { background: color, border: '#fff' },
          shape: shape,
          size: size,
          font: { color: fontColor, face: 'Outfit' }
        });
        addedNodes.add(term.value);
      }
    });

    edges.add({
      from: subj.value,
      to: obj.value,
      label: getLabel(pred),
      arrows: 'to',
      color: { color: 'rgba(148, 163, 184, 0.4)' },
      font: { color: '#8b949e', size: 10, align: 'middle' }
    });
  });

  const container = document.getElementById('mynetwork');
  const data = { nodes: nodes, edges: edges };
  const options = {
    nodes: { borderWidth: 2, shadow: true },
    physics: {
      enabled: true,
      barnesHut: { gravitationalConstant: -2000, centralGravity: 0.3, springLength: 150 }
    },
    interaction: { hover: true }
  };

  network = new vis.Network(container, data, options);

  network.on("click", function (params) {
    if (params.nodes.length > 0) {
      const nodeId = params.nodes[0];
      const nodeData = nodes.get(nodeId);
      document.getElementById('user-input').value = nodeData.label + "에 대해 알려줘";
    }
  });
}

function handleKeyPress(e) {
  if (e.key === 'Enter') sendMessage();
}

function appendMessage(text, sender) {
  const chatBox = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = `message ${sender}`;
  div.innerHTML = text;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function sendMessage() {
  const input = document.getElementById('user-input');
  const question = input.value.trim();
  if (!question) return;

  appendMessage(question, 'user');
  input.value = '';

  setTimeout(() => {
    const answer = generateAnswer(question);
    appendMessage(answer, 'bot');
  }, 500);
}

function generateAnswer(q) {
  // Character Info
  if (q.includes('개미') && (q.includes('성격') || q.includes('특징') || q.includes('어때'))) {
    const traits = store.getQuads(namedNode(EX + 'Ant'), namedNode(EX + 'trait'), null, null);
    const traitList = traits.map(t => t.object.value).join(', ');
    highlightNode(EX + 'Ant');
    return `개미는 아주 <strong>${traitList}</strong> 친구야!`;
  }
  if (q.includes('배짱이') && (q.includes('성격') || q.includes('특징') || q.includes('어때'))) {
    const traits = store.getQuads(namedNode(EX + 'Grasshopper'), namedNode(EX + 'trait'), null, null);
    const traitList = traits.map(t => t.object.value).join(', ');
    highlightNode(EX + 'Grasshopper');
    return `배짱이는 노래를 좋아하고 <strong>${traitList}</strong> 면이 있어.`;
  }

  // Winter Scene
  if (q.includes('겨울') || q.includes('나중')) {
    const antStatus = store.getQuads(namedNode(EX + 'WinterScene'), namedNode(EX + 'antStatus'), null, null);
    const hopperStatus = store.getQuads(namedNode(EX + 'WinterScene'), namedNode(EX + 'grasshopperStatus'), null, null);
    highlightNode(EX + 'WinterScene');
    return `추운 겨울이 되자, 개미는 <strong>${antStatus[0].object.value}</strong> 보냈지만, 배짱이는 <strong>${hopperStatus[0].object.value}</strong> 됐단다.`;
  }

  // Summer Scene
  if (q.includes('여름')) {
    const antAction = store.getQuads(namedNode(EX + 'SummerScene'), namedNode(EX + 'antAction'), null, null);
    const hopperAction = store.getQuads(namedNode(EX + 'SummerScene'), namedNode(EX + 'grasshopperAction'), null, null);
    highlightNode(EX + 'SummerScene');
    return `더운 여름에 개미는 <strong>${antAction[0].object.value}</strong>. 반면에 배짱이는 <strong>${hopperAction[0].object.value}</strong> 하며 놀았어.`;
  }

  // Moral
  if (q.includes('교훈') || q.includes('작가') || q.includes('말하고')) {
    const moral = store.getQuads(null, namedNode(EX + 'moral'), null, null);
    highlightNode(moral[0].subject.value);
    return `이 이야기의 교훈은 <strong>"${moral[0].object.value}"</strong>란다.`;
  }

  return "미안해, 그 질문은 잘 모르겠어. 개미나 배짱이가 여름이나 겨울에 무엇을 했는지 물어봐 줄래?";
}

function highlightNode(uri) {
  if (network) {
    network.selectNodes([uri]);
    network.focus(uri, { scale: 1.2, animation: true });
  }
}

init();
