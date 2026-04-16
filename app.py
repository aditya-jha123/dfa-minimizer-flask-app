import os
from flask import Flask, render_template

# Find the exact absolute path of the directory containing app.py
base_dir = os.path.abspath(os.path.dirname(__file__))

# Explicitly tell Flask where the 'templates' and 'static' folders are
app = Flask(__name__, 
            template_folder=os.path.join(base_dir, 'templates'),
            static_folder=os.path.join(base_dir, 'static'))

@app.route('/')
def home():
    return render_template('index.html')

if __name__ == '__main__':
    app.run(debug=True, port=5000)
