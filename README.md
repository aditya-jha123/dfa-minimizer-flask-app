# DFA Minimizer & Visualizer

A web-based educational tool and visualization engine that minimizes Deterministic Finite Automata (DFA) using **Hopcroft's Algorithm**. 

This application takes in raw DFA inputs or Regular Expressions, determinizes them, and provides a beautiful, interactive, step-by-step breakdown of the state-partitioning minimization process.

![DFA Minimizer](https://img.shields.io/badge/Status-Active-success) ![UI](https://img.shields.io/badge/UI-Dark_Editorial-0e1420) ![Algorithm](https://img.shields.io/badge/Algorithm-Hopcroft's-a78bfa)

## ✨ Core Features

The application supports three distinct input modes to generate the initial automaton:

1. **Manual Matrix Entry:** Define states, alphabet, and target transitions via a dynamically generated HTML table.
2. **Regex Engine:** Enter a regular expression. The app tokenizes it, builds a Thompson NFA, and converts it to a DFA using subset construction.
3. **Interactive Canvas:** Draw states and connect them with arrows by hand on a digital whiteboard.

Once the automaton is provided, the tool minimizes it and outputs:
* **Live Algorithm Walkthrough:** A dynamic log that explains *why* specific states are split during the partitioning process.
* **Network Graph:** An interactive, physics-based network visualization of the final minimized DFA.
* **Minimized Transition Table:** A clean, easy-to-read transition matrix of the optimized states.

---

## 🚀 v2.0 Extension Updates

This project recently underwent a major update to its parsing engine and visual layout:

### Advanced Regex Pre-Processing
* **Exponent Support (`^n`):** Added algebraic-style repeat operators. Expressions like `a^3` automatically expand to `aaa`, and `(ab)^2` to `(ab)(ab)`, prior to tokenization.
* **Interactive Regex Toolbar:** Replaced plain text hints with a clickable GUI toolbar that cleanly injects concatenation (`·`), union (`|`), Kleene stars (`*`), optional operators (`?`), and brackets directly into the cursor position.

### Network Graph Layout & Physics Overhaul
* **Algorithmic Layout Shift:** Migrated the `vis-network` engine from a rigid hierarchical layout to a physics-based `barnesHut` model, allowing the graph to breathe and adapt to complex state machines.
* **Curved & Bidirectional Routing:** Implemented `curvedCW` edges to ensure transitions like `A → B` and `B → A` render as distinct ovals, eliminating overlapping lines.
* **Self-Loop Rendering:** Adjusted z-indices and sizing to prevent self-referential inputs (e.g., `q0` looping on `b`) from hiding behind solid node backgrounds.
* **Custom SVG Nodes:** Upgraded visual distinctiveness by attaching transition arrows to the outer radii of custom SVG shapes (e.g., double-rings for Accept states).

---

## 🛠️ Tech Stack

* **Backend:** Python, Flask
* **Frontend:** HTML5, CSS3 (Custom Dark Editorial Theme), Vanilla JavaScript
* **Graphing Library:** [vis-network](https://visjs.github.io/vis-network/docs/network/)
* **Font Typography:** *Syne* (Display), *Fira Code* (Monospace)

---

## 💻 Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/aditya-jha123/dfa-minimizer.git](https://github.com/yourusername/dfa-minimizer.git)
   cd dfa-minimizer
   python -m venv venv
source venv\Scripts\activate 
pip install flask
python app.py
📖 **How to Use**
Select an Input Mode: Choose between Manual, Regex, or Draw from the left-hand panel.

Provide Automaton Data: Fill in the transition table, type a regular expression, or draw your states.

Initialize: Click the Initialize button to parse the data and remove unreachable states.

Step-by-Step: Click Next Step to step through Hopcroft's table-filling/partitioning algorithm sequentially, or click Run All to skip to the end.

Analyze: Interact with the generated network graph (zoom/drag) and review the logic in the Live Algorithm Walkthrough panel.

📝 **License**
This project is open-source and available under the MIT License.
