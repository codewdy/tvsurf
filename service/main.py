from service.app import App
import argparse
import sys
import os


def default_config_path():
    if hasattr(sys, "_MEIPASS"):
        return os.path.join(os.path.dirname(sys.argv[0]), "config.yaml")
    else:
        return "config.yaml"


parser = argparse.ArgumentParser()
parser.add_argument("--config", default=default_config_path(), help="config file path")
args = parser.parse_args()

app = App(args.config)
app.serve()
