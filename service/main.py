from .app import App
import argparse

parser = argparse.ArgumentParser()
parser.add_argument("--config", default="config.yaml", help="config file path")
args = parser.parse_args()

app = App(args.config)
app.serve()
