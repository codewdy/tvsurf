import yaml
from service.schema.config import Config
import os


def merge_config_path(path: str, config_dict: dict, arg_1: str, *args) -> None:
    if len(args) == 0:
        config_dict[arg_1] = os.path.join(os.path.dirname(path), config_dict[arg_1])
        return
    if arg_1 in config_dict:
        merge_config_path(path, config_dict[arg_1], *args)


def load_config(path: str) -> Config:
    with open(path, "r", encoding="utf-8") as f:
        config_dict = yaml.safe_load(f)
        merge_config_path(path, config_dict, "data_dir")
        merge_config_path(path, config_dict, "logger", "filename")
        return Config.model_validate(config_dict)
