# dfa-minimizer-flask-app
this is a web tool which helps to minimize dfa by showing step by step process using partition method and generating a minimized graph and transition table at the end
# 🕸️ DFA Minimization Visualizer

A sleek, interactive web application that visualizes the step-by-step process of minimizing a Deterministic Finite Automaton (DFA). Built with a modern **Dark Glassmorphism** UI, this tool is designed for computer science students, educators, and automaton enthusiasts to easily understand and compute DFA minimization.

![DFA Visualizer Screenshot](link-to-your-screenshot-here.png) *(Note: Replace with a screenshot of your app)*

## ✨ Features

* **Modern Glassmorphism UI:** A beautiful dark mode interface with frosted glass panels, vibrant gradient backgrounds, and fully responsive design.
* **Dynamic Transition Matrix:** Say goodbye to clunky text inputs! Input your states and alphabet to automatically generate a clean, paper-style δ (delta) transition matrix grid.
* **Step-by-Step Visualization:** Watch the Myhill-Nerode partitioning process unfold step-by-step as equivalent states are grouped and split.
* **Interactive Graph Rendering:** Powered by `Vis.js`, the minimized DFA is plotted as an interactive, draggable network graph.
* **Automated Textbook-Style Tables:** Generates a final minimized transition table complete with visual badges for Start and Accept states.

## 🧠 Algorithms Under the Hood

This visualizer perfectly minimizes any valid DFA by running two distinct algorithms side-by-side:

1. **Breadth-First Search (BFS) for Reachability:** Before minimization begins, a BFS sweep starting from the Start State identifies and permanently eliminates any unreachable "dead/floating" states from the graph.
2. **Moore’s Algorithm (Partition Method):** Based on the Myhill-Nerode Theorem, this algorithm groups states into initial partitions (Accept vs. Non-Accept) and iteratively checks their transition signatures, splitting them until only truly equivalent states remain grouped together.

## 🛠️ Tech Stack

* **Frontend:** HTML5, CSS3 (Custom Glassmorphism theme), Vanilla JavaScript
* **Graphing Library:** [Vis.js Network](https://visjs.github.io/vis-network/)
* **Backend:** Python & Flask *(Assuming standard Flask setup based on `/templates` and `/static` structure)*

## 🚀 How to Run Locally

### Prerequisites
Make sure you have [Python 3.x](https://www.python.org/downloads/) installed on your machine.

### Installation Steps
1. **Clone the repository:**
   ```bash
   git clone [https://github.com/yourusername/dfa-minimization-visualizer.git](https://github.com/yourusername/dfa-minimization-visualizer.git)
   cd dfa-minimization-visualizer
