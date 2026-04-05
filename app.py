from flask import Flask, render_template

app = Flask(__name__)

@app.route('/')
def home():
    # This looks inside the 'templates' folder for 'index.html'
    return render_template('index.html')

if __name__ == '__main__':
    # Runs the server in debug mode so it auto-updates when you save changes
    app.run(debug=True, port=5000)
