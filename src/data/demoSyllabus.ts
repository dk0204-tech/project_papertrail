import { Syllabus, SyllabusUnit } from '../types'
import { DEMO_SUBJECTS } from './demoSubjects'

/**
 * ILLUSTRATIVE DEMO SYLLABUS STRUCTURES — NOT VERIFIED OFFICIAL MIT MANIPAL
 * CURRICULUM. These structures exist only so the classification engine has a
 * realistic hierarchy to map questions onto in demo mode. Users can replace
 * any of them with their own syllabus (upload / manual / JSON import).
 *
 * Compact tuple notation:
 *   topic    = "Topic name"  or  [name, subtopics[]]
 *   chapter  = [name, topics[]]
 *   unit     = [title, chapters[]]
 */

type RawTopic = string | [string, string[]]
type RawChapter = [string, RawTopic[]]
type RawUnit = [string, RawChapter[]]

const RAW: Record<string, RawUnit[]> = {
  // ── Semester 1 ────────────────────────────────────────────────────────────
  'sub-pps': [
    ['Programming Foundations', [
      ['Problem Solving & Algorithms', ['Flowcharts', 'Pseudocode']],
      ['C Data Types & Operators', ['Variables and scope', 'Type conversion']],
    ]],
    ['Control Structures & Functions', [
      ['Conditional & Iterative Control', ['if-else nesting', 'Loop invariants']],
      ['Functions & Recursion', ['Call stack', 'Tail recursion']],
    ]],
    ['Arrays, Strings & Pointers', [
      ['Arrays & Strings', ['2D arrays', 'String library functions']],
      ['Pointers & Dynamic Memory', ['Pointer arithmetic', 'malloc and free']],
    ]],
    ['Files & Structured Data', [
      ['File Handling', ['Sequential file access', 'Error handling']],
      ['Structures & Unions', ['Nested structures', 'typedef and enums']],
    ]],
  ],
  'sub-math1': [
    ['Differential Calculus', [
      ['Limits & Continuity', ['Epsilon-delta definition', 'Indeterminate forms']],
      ['Differentiation', ['Implicit differentiation', 'Higher order derivatives']],
    ]],
    ['Applications of Differentiation', [
      ['Mean Value Theorems', ["Rolle's theorem", "Lagrange & Cauchy MVT"]],
      ['Curve Sketching', ['Asymptotes', 'Concavity and inflection']],
    ]],
    ['Integral Calculus', [
      ['Single Integration', ['Integration by substitution', 'Integration by parts']],
      ['Multiple Integrals', ['Double integrals', 'Change of order of integration']],
    ]],
    ['Sequences & Series', [
      ['Infinite Series', ['Ratio and root tests', 'Alternating series test']],
      ['Taylor Series', ['Maclaurin expansion', 'Truncation error bounds']],
    ]],
  ],
  'sub-eee': [
    ['DC Circuit Analysis', [
      ['Network Theorems', ['Thevenin and Norton', 'Superposition theorem']],
      ['Kirchhoff Laws & Mesh Analysis', ['Mesh current method', 'Nodal analysis']],
    ]],
    ['AC Circuit Fundamentals', [
      ['Sinusoidal Steady State', ['Phasor representation', 'Power factor correction']],
      ['Resonance & Networks', ['Series resonance', 'Quality factor']],
    ]],
    ['Transformers & Machines', [
      ['Single Phase Transformers', ['Equivalent circuit', 'Efficiency and regulation']],
      ['DC Machines', ['Shunt and series motors', 'Speed control']],
    ]],
    ['Three Phase & Measurements', [
      ['Three Phase Systems', ['Star-delta connections', 'Two-wattmeter method']],
      ['Measuring Instruments', ['Wattmeter and energy meters', 'CT and PT']],
    ]],
  ],

  // ── Semester 2 ────────────────────────────────────────────────────────────
  'sub-math2': [
    ['Ordinary Differential Equations', [
      ['First Order ODEs', ['Bernoulli equation', 'Exact equations']],
      ['Higher Order ODEs', ['Constant coefficients', 'Undetermined coefficients']],
    ]],
    ['Transforms & Series Solutions', [
      ['Laplace Transforms', ['Inverse transforms', 'Unit step function']],
      ['Fourier Series', ['Even and odd functions', 'Half range expansions']],
    ]],
    ['Vector Calculus', [
      ['Gradient & Divergence', ['Directional derivative', "Green's theorem"]],
      ['Surface & Volume Integrals', ["Stokes theorem", "Gauss divergence theorem"]],
    ]],
    ['Complex Analysis', [
      ['Analytic Functions', ['Cauchy-Riemann equations', 'Harmonic functions']],
      ['Contour Integration', ['Residue theorem', 'Laurent series']],
    ]],
  ],
  'sub-see': [
    ['Semiconductor Devices', [
      ['Diodes & Applications', ['Zener voltage regulation', 'Clipper and clamper circuits']],
      ['Transistors', ['Biasing techniques', 'Common emitter configuration']],
    ]],
    ['Analog Circuits', [
      ['Op-Amp Fundamentals', ['Inverting and non-inverting amplifiers', 'Summing amplifier']],
      ['Oscillators & Feedback', ['Barkhausen criterion', 'Wien bridge oscillator']],
    ]],
    ['Digital Building Blocks', [
      ['Number Systems & Logic Gates', ['K-map simplification', 'Boolean algebra identities']],
      ['Combinational Logic', ['Multiplexers and decoders', 'Code converters']],
    ]],
    ['Communication & Sensors', [
      ['Amplitude & Frequency Modulation', ['Noise and SNR', 'Demodulation circuits']],
      ['Transducers & Sensors', ['Strain gauge', 'Thermistor characteristics']],
    ]],
  ],
  'sub-egd': [
    ['Engineering Drawing Fundamentals', [
      ['Projection Systems', ['First angle projection', 'Third angle projection']],
      ['Lines & Planes', ['True length of lines', 'Trace of a plane']],
    ]],
    ['Sections & Solids', [
      ['Sectional Views', ['Section planes', 'Hatching conventions']],
      ['Development of Surfaces', ['Prism development', 'Cylinder development']],
    ]],
    ['Isometric & Perspective', [
      ['Isometric Projection', ['Isometric scale', 'Curved surfaces in isometric']],
      ['Perspective Views', ['Vanishing points', 'Visual ray method']],
    ]],
    ['Machine Drawing', [
      ['Threads & Fasteners', ['Screw thread profiles', 'Nut and bolt drawings']],
      ['Assembly Drawing', ['Sectioned assembly', 'Bill of materials']],
    ]],
  ],

  // ── Semester 3 ────────────────────────────────────────────────────────────
  'sub-dsa': [
    ['Introduction & Linear Data Structures', [
      ['Arrays and Strings', ['Array Operations & Multi-dimensional Arrays', 'String Matching Algorithms']],
      ['Linked Lists', ['Singly Linked Lists', 'Doubly and Circular Linked Lists']],
      ['Stacks and Queues', ['Stack Applications', 'Queues & Deques']],
    ]],
    ['Non-Linear Data Structures: Trees', [
      ['Binary Trees', ['Tree Traversals', 'Threaded Binary Trees']],
      ['Binary Search Trees (BST)', ['BST Operations', 'Balanced Search Trees']],
      ['Priority Queues & Heaps', ['Binary Heaps', 'Binomial & Fibonacci Heaps']],
    ]],
    ['Graphs and Advanced Structures', [
      ['Graph Representations & Traversals', ['Graph Storage', 'Graph Search']],
      ['Shortest Path & Minimum Spanning Trees', ['MST Algorithms', 'Shortest Path']],
    ]],
    ['Hashing and Advanced Sorting', [
      ['Hashing Techniques', ['Hash Functions', 'Collision Resolution']],
      ['Advanced Sorting', ['Comparison Sorts', 'Linear Time Sorts']],
    ]],
  ],
  'sub-dm': [
    ['Logic & Proofs', [
      ['Propositional Logic', ['Truth tables', 'Logical equivalences']],
      ['Proof Techniques', ['Mathematical induction', 'Contradiction and contraposition']],
    ]],
    ['Set Theory & Relations', [
      ['Sets & Functions', ['Power sets', 'Cardinality of sets']],
      ['Relations & Partial Orders', ['Equivalence relations', 'Hasse diagrams']],
    ]],
    ['Combinatorics', [
      ['Counting Principles', ['Permutations and combinations', 'Inclusion-exclusion principle']],
      ['Recurrence Relations', ['Linear recurrences', 'Generating functions']],
    ]],
    ['Graph Theory & Algebra', [
      ['Graphs & Trees', ['Euler and Hamiltonian paths', 'Graph coloring']],
      ['Groups & Rings', ['Permutation groups', 'Congruence modulo n']],
    ]],
  ],
  'sub-dss': [
    ['Number Systems & Logic', [
      ['Binary Arithmetic', ["2's complement arithmetic", 'BCD and Gray code']],
      ['Boolean Algebra & K-Maps', ['K-map minimization', "Don't care conditions"]],
    ]],
    ['Combinational Circuits', [
      ['Design of Combinational Logic', ['Adders and subtractors', 'Comparators']],
      ['Arithmetic & Data Selection Circuits', ['Ripple carry adder', 'Multiplexers and decoders']],
    ]],
    ['Sequential Circuits', [
      ['Latches & Flip-Flops', ['Characteristic tables', 'Excitation tables']],
      ['Registers & Counters', ['Shift registers', 'Mod-n counters']],
    ]],
    ['Memory & Programmable Logic', [
      ['Semiconductor Memories', ['SRAM vs DRAM', 'Memory decoding']],
      ['PLD & FSM Design', ['PLA and PAL', 'Mealy and Moore machines']],
    ]],
  ],

  // ── Semester 4 ────────────────────────────────────────────────────────────
  'sub-cn': [
    ['Foundations & Physical Layer', [
      ['Network Models', ['OSI reference model', 'TCP/IP model']],
      ['Physical Transmission Media', ['Twisted pair and fibre', 'Multiplexing techniques']],
    ]],
    ['Data Link & MAC', [
      ['Error Control & Framing', ['CRC and checksums', 'Sliding window protocols']],
      ['MAC Sublayer & Ethernet', ['CSMA/CD', 'Switching and VLANs']],
    ]],
    ['Network Layer', [
      ['IP Addressing & Subnetting', ['CIDR and VLSM', 'NAT traversal']],
      ['Routing Protocols', ['Distance vector routing', 'Link state routing']],
    ]],
    ['Transport & Application', [
      ['TCP & UDP', ['TCP congestion control', 'Three way handshake']],
      ['Application Layer Protocols', ['HTTP and DNS', 'SMTP and DHCP']],
    ]],
  ],
  'sub-os': [
    ['Operating System Fundamentals', [
      ['OS Structure & Services', ['System calls', 'Kernel architecture']],
      ['Process Management', ['Process states', 'Context switching']],
    ]],
    ['Concurrency & Scheduling', [
      ['Threads & Scheduling', ['Round robin scheduling', 'Priority scheduling']],
      ['Synchronization', ['Semaphores', 'Producer-consumer problem']],
    ]],
    ['Memory Management', [
      ['Virtual Memory & Paging', ['Page replacement algorithms', 'Thrashing']],
      ['Segmentation & TLB', ['Segmentation schemes', 'TLB reach']],
    ]],
    ['Storage & Deadlock', [
      ['File Systems', ['Inode structures', 'Directory structures']],
      ['Deadlock & I/O', ["Banker's algorithm", 'Disk scheduling algorithms']],
    ]],
  ],
  'sub-dbs': [
    ['Relational Foundations', [
      ['Relational Model', ['Keys and integrity constraints', 'Relational algebra']],
      ['ER Modelling', ['Entity and relationship sets', 'Cardinality constraints']],
    ]],
    ['SQL', [
      ['SQL Queries', ['Joins and subqueries', 'Aggregate functions']],
      ['Advanced SQL', ['Views and materialized views', 'Triggers and stored procedures']],
    ]],
    ['Database Design & Normalization', [
      ['Functional Dependencies', ['Armstrong axioms', 'Attribute closure computation']],
      ['Normalization', ['BCNF decomposition', '3NF and 4NF']],
    ]],
    ['Transaction & Storage', [
      ['Transactions & ACID', ['Conflict serializability', 'Failure recovery']],
      ['Indexing & Storage', ['B+ tree indexing', 'Hash indices']],
    ]],
  ],

  // ── Semester 5 ────────────────────────────────────────────────────────────
  'sub-ml': [
    ['Foundations of Learning', [
      ['Supervised vs Unsupervised Learning', ['Bias-variance tradeoff', 'Feature engineering']],
      ['Linear Models', ['Linear regression', 'Logistic regression']],
    ]],
    ['Classification & Evaluation', [
      ['Decision Trees & Ensembles', ['Random forest', 'Gradient boosting']],
      ['Model Evaluation', ['Cross validation', 'ROC and confusion matrix']],
    ]],
    ['Unsupervised Learning', [
      ['Clustering', ['K-means clustering', 'DBSCAN']],
      ['Dimensionality Reduction', ['Principal component analysis', 't-SNE visualisation']],
    ]],
    ['Advanced & Probabilistic Models', [
      ['Support Vector Machines', ['Kernel trick', 'Margin maximization']],
      ['Bayesian Learning', ['Naive Bayes classifier', 'MAP estimation']],
    ]],
  ],
  'sub-coa': [
    ['Computer Fundamentals', [
      ['Instruction Set Architecture', ['Addressing modes', 'Instruction formats']],
      ['Data Representation', ['IEEE 754 floating point', 'Error detection codes']],
    ]],
    ['Processor Design', [
      ['Datapath & Control', ['Hardwired control unit', 'Microprogrammed control']],
      ['Pipelining', ['Pipeline hazards', 'Forwarding and stalling']],
    ]],
    ['Memory Hierarchy', [
      ['Cache Memory', ['Associative mapping', 'Write policies']],
      ['Main Memory & I/O', ['Memory interleaving', 'DMA transfers']],
    ]],
    ['I/O & Parallelism', [
      ['I/O Organization', ['Interrupt handling', 'Bus arbitration']],
      ['Parallel & RISC Architectures', ['Instruction level parallelism', 'RISC vs CISC']],
    ]],
  ],
  'sub-toc': [
    ['Automata Foundations', [
      ['Finite Automata', ['DFA and NFA', 'Regular expressions']],
      ['Regular Languages', ['Pumping lemma', 'Closure properties']],
    ]],
    ['Context Free Languages', [
      ['Context Free Grammars', ['Parse trees', 'Ambiguity in grammars']],
      ['Pushdown Automata', ['PDA transitions', 'Chomsky normal form']],
    ]],
    ['Turing Machines & Computability', [
      ['Turing Machines', ['Multi-tape variants', 'Decidability']],
      ['Undecidability & Reducibility', ['Halting problem', "Rice's theorem"]],
    ]],
    ['Complexity Theory', [
      ['Complexity Classes', ['P vs NP', 'NP-completeness']],
      ['Space Complexity', ['Savitch theorem', 'PSPACE completeness']],
    ]],
  ],

  // ── Semester 6 ────────────────────────────────────────────────────────────
  'sub-ai': [
    ['Intelligent Agents', [
      ['Foundations of AI', ['Turing test', 'Intelligent agent architectures']],
      ['Search Strategies', ['Uninformed search', 'Heuristic search and A*']],
    ]],
    ['Knowledge & Reasoning', [
      ['Knowledge Representation', ['Propositional logic', 'Predicate logic']],
      ['Inference & Ontologies', ['Resolution principle', 'Semantic networks']],
    ]],
    ['Planning & Uncertainty', [
      ['Planning Algorithms', ['STRIPS operator', 'Partial order planning']],
      ['Uncertain Reasoning', ['Bayesian networks', 'Fuzzy logic controllers']],
    ]],
    ['Learning & Applications', [
      ['Reinforcement Learning', ['Q-learning', 'Markov decision processes']],
      ['AI Applications', ['Expert systems', 'Game playing agents']],
    ]],
  ],
  'sub-cns': [
    ['Classical & Symmetric Crypto', [
      ['Cryptanalysis Fundamentals', ['Caesar and substitution ciphers', 'Frequency analysis']],
      ['Block Ciphers', ['DES structure', 'AES round operations']],
    ]],
    ['Public Key & Hashing', [
      ['Asymmetric Cryptography', ['RSA algorithm', 'Diffie-Hellman key exchange']],
      ['Hash Functions & Signatures', ['SHA family', 'Digital signatures']],
    ]],
    ['Network Security Protocols', [
      ['Authentication Protocols', ['Kerberos protocol', 'Challenge-response authentication']],
      ['Secure Channels', ['TLS handshake', 'IPsec tunnel mode']],
    ]],
    ['System & Application Security', [
      ['Malware & Defenses', ['Buffer overflow attacks', 'Intrusion detection systems']],
      ['Wireless & Web Security', ['WPA and WEP', 'SQL injection and XSS']],
    ]],
  ],
  'sub-cloud': [
    ['Cloud Fundamentals', [
      ['Cloud Service Models', ['IaaS and PaaS', 'Deployment models']],
      ['Virtualization', ['Hypervisor types', 'Container virtualization']],
    ]],
    ['Cloud Architecture', [
      ['Data Centre Architecture', ['Rack and pod design', 'Google file system']],
      ['Cloud Storage', ['Object storage', 'Replication strategies']],
    ]],
    ['Services & Orchestration', [
      ['Compute & Orchestration', ['Kubernetes clusters', 'Auto scaling policies']],
      ['Serverless & Microservices', ['Lambda functions', 'API gateways']],
    ]],
    ['Cloud Security & Economics', [
      ['Cloud Security', ['Identity and access management', 'Encryption at rest']],
      ['Cloud Economics', ['Pay-as-you-go pricing', 'Service level agreements']],
    ]],
  ],

  // ── Semester 7 ────────────────────────────────────────────────────────────
  'sub-dl': [
    ['Neural Network Foundations', [
      ['Perceptrons & MLPs', ['Backpropagation', 'Activation functions']],
      ['Optimization for Deep Networks', ['SGD and momentum', 'Batch normalization']],
    ]],
    ['Convolutional Networks', [
      ['CNN Architectures', ['Convolution and pooling', 'ResNet blocks']],
      ['Computer Vision Applications', ['Object detection', 'Image segmentation']],
    ]],
    ['Sequence Models', [
      ['Recurrent Networks', ['LSTM and GRU', 'Sequence to sequence models']],
      ['Attention & Transformers', ['Self-attention mechanism', 'Positional encoding']],
    ]],
    ['Generative & Advanced Models', [
      ['Generative Models', ['Variational autoencoders', 'Generative adversarial networks']],
      ['Training & Regularization', ['Dropout', 'Transfer learning']],
    ]],
  ],
  'sub-bigdata': [
    ['Big Data Foundations', [
      ['Characteristics of Big Data', ['Volume and velocity', 'Data lakes']],
      ['Distributed File Systems', ['HDFS architecture', 'Data replication']],
    ]],
    ['Distributed Processing', [
      ['MapReduce Paradigm', ['Combiner and shuffle', 'Job scheduling']],
      ['Apache Spark', ['Resilient distributed datasets', 'Spark SQL']],
    ]],
    ['NoSQL & Streaming', [
      ['NoSQL Databases', ['Columnar stores', 'Eventual consistency']],
      ['Stream Processing', ['Apache Kafka', 'Windowing operations']],
    ]],
    ['Analytics & Visualization', [
      ['Machine Learning at Scale', ['Feature pipelines', 'Model deployment']],
      ['Data Visualization', ['Dashboards', 'Statistical storytelling']],
    ]],
  ],
  'sub-iot': [
    ['IoT Foundations', [
      ['IoT Architecture', ['Sensing layer', 'Gateway devices']],
      ['Communication Protocols', ['MQTT protocol', 'Zigbee and BLE']],
    ]],
    ['Embedded & Edge', [
      ['Microcontrollers & Sensors', ['Arduino and ESP32', 'Sensor calibration']],
      ['Edge Computing', ['Fog nodes', 'On-device inference']],
    ]],
    ['IoT Platforms & Security', [
      ['IoT Platforms', ['Device provisioning', 'Telemetry dashboards']],
      ['IoT Security', ['Device authentication', 'Secure firmware update']],
    ]],
    ['Applications', [
      ['Smart Systems', ['Smart lighting', 'Wearable devices']],
      ['Industrial IoT', ['Predictive maintenance', 'Digital twins']],
    ]],
  ],

  // ── Semester 8 ────────────────────────────────────────────────────────────
  'sub-nlp': [
    ['Language Foundations', [
      ['Morphology & Tokenization', ['Stemming and lemmatization', 'Word boundaries']],
      ['N-grams & Language Models', ['Markov assumption', 'Perplexity']],
    ]],
    ['Parsing & Semantics', [
      ['Syntactic Parsing', ['CFG parsing', 'Dependency parsing']],
      ['Semantic Analysis', ['Word sense disambiguation', 'Named entity recognition']],
    ]],
    ['Sequence & Transformer Models', [
      ['Sequence-to-Sequence Models', ['Encoder-decoder architecture', 'Beam search']],
      ['Transformers & BERT', ['Masked language modelling', 'Fine-tuning']],
    ]],
    ['Applications', [
      ['Machine Translation', ['Attention alignment', 'BLEU score']],
      ['Sentiment & QA Systems', ['Aspect based sentiment analysis', 'Retrieval based QA']],
    ]],
  ],
  'sub-distsys': [
    ['Foundations', [
      ['Properties of Distributed Systems', ['Transparency', 'Synchrony models']],
      ['Interprocess Communication', ['RPC and RMI', 'Message passing']],
    ]],
    ['Coordination & Consistency', [
      ['Clocks & Ordering', ['Lamport clocks', 'Vector clocks']],
      ['Consistency Models', ['Sequential consistency', 'Eventual consistency']],
    ]],
    ['Replication & Fault Tolerance', [
      ['Distributed Consensus', ['Paxos protocol', 'Raft consensus']],
      ['Fault Tolerance', ['Failure detection', 'Checkpointing']],
    ]],
    ['Distributed Storage', [
      ['Distributed File Systems & Databases', ['Sharding strategies', 'Two-phase commit']],
      ['Distributed Transactions', ['Saga pattern', 'Idempotency']],
    ]],
  ],
  'sub-genai': [
    ['Generative Foundations', [
      ['Probability for Generation', ['Sampling and temperature', 'Chain rule of probability']],
      ['Autoregressive Models', ['Token prediction', 'Decoder only transformers']],
    ]],
    ['Diffusion & Latent Models', [
      ['Diffusion Models', ['Noise scheduling', 'Latent diffusion']],
      ['Variational Autoencoders', ['Latent space', 'Reparameterization trick']],
    ]],
    ['Alignment & Fine-tuning', [
      ['Fine-tuning Methods', ['LoRA adapters', 'Instruction tuning']],
      ['Alignment & RLHF', ['Reward modelling', 'Preference optimization']],
    ]],
    ['Evaluation & Applications', [
      ['Evaluation of Generative Models', ['Perplexity', 'Human evaluation protocols']],
      ['Responsible Generative AI', ['Hallucination mitigation', 'Bias auditing']],
    ]],
  ],
}

function toUnits(raw: RawUnit[]): SyllabusUnit[] {
  return raw.map(([title, chapters], i) => ({
    unitNumber: i + 1,
    title,
    chapters: chapters.map(([name, topics]) => ({
      name,
      topics: topics.map((t) =>
        typeof t === 'string' ? { name: t, subTopics: [] as string[] } : { name: t[0], subTopics: t[1] },
      ),
    })),
  }))
}

/** All bundled demo syllabi, keyed by subject id. */
export const DEMO_SYLLABI: Record<string, Syllabus> = Object.fromEntries(
  DEMO_SUBJECTS.map((subject) => [
    subject.id,
    {
      subjectId: subject.id,
      subject: subject.name,
      subjectCode: subject.code,
      department: subject.department,
      programme: subject.programme,
      semester: subject.semester,
      provenance: 'demo-illustrative' as const,
      units: toUnits(RAW[subject.id] ?? RAW['sub-dsa']),
    },
  ]),
)

/** Flat list of every (unit, chapter, topic, subtopic) entry for a subject. */
export interface SyllabusLeaf {
  unit: string
  chapter: string
  topic: string
  subtopic: string
}

export function flattenSyllabus(syllabus: Syllabus): SyllabusLeaf[] {
  const leaves: SyllabusLeaf[] = []
  for (const unit of syllabus.units) {
    const unitLabel = `Unit ${unit.unitNumber}: ${unit.title}`
    for (const chapter of unit.chapters) {
      for (const topic of chapter.topics) {
        if (topic.subTopics.length === 0) {
          leaves.push({ unit: unitLabel, chapter: chapter.name, topic: topic.name, subtopic: '' })
        } else {
          for (const sub of topic.subTopics) {
            leaves.push({ unit: unitLabel, chapter: chapter.name, topic: topic.name, subtopic: sub })
          }
        }
      }
    }
  }
  return leaves
}
