# 仓库格式化规则

修改代码、配置或文档后，只格式化本次任务实际修改或新增的文件，并对同一组文件执行格式检查。不要自动格式化整个仓库，也不要把工作区中其他已有改动加入格式化范围。

在仓库根目录显式传入文件路径，例如本次仅修改了 `app/App.tsx` 和 `app/utils/dataSync.ts`：

```sh
python3 tools/format.py app/App.tsx app/utils/dataSync.ts
python3 tools/format.py --check app/App.tsx app/utils/dataSync.ts
```

路径相对于仓库根目录，包含空格时加引号。不传文件时脚本报错，不会默认扫描并格式化整个仓库。`--check` 只检查，不写入文件；格式不一致或工具执行失败时返回非零退出码。

只有用户明确要求全仓库格式化时才运行：

```sh
python3 tools/format.py --all
python3 tools/format.py --all --check
```

脚本只处理 Git 已跟踪文件和未被忽略的新文件。全仓库模式跳过已删除文件和符号链接；显式指定的文件不存在、被忽略或不是普通仓库文件时会报错。不要格式化依赖目录、虚拟环境、构建产物、运行时数据或二进制资源，也不要为了格式化修改业务逻辑。

## 当前文件类型

| 文件类型                                                              | 格式化命令                                                    | 规则                                                                           |
| --------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Python：`.py`、`.pyi`、PyInstaller `.spec`                            | `ruff format --force-exclude --extension spec:python <files>` | Ruff 默认格式：4 空格缩进、88 字符行宽、双引号；不执行 lint 自动修复或导入排序 |
| JavaScript / TypeScript：`.js`、`.jsx`、`.mjs`、`.cjs`、`.ts`、`.tsx` | `prettier --write <files>`                                    | Prettier 默认格式：2 空格缩进、80 字符行宽、分号、双引号、允许处保留尾逗号     |
| JSON / JSONC、YAML、HTML、CSS / SCSS / Less、Markdown / MDX           | `prettier --write <files>`                                    | 使用各语言的默认 parser 和格式规则，不额外强制 Markdown 段落换行               |
| Shell：`.sh`、`.bash`                                                 | `shfmt -i 2 -w <files>`                                       | 2 空格缩进，保留脚本语言语义                                                   |

优先遵循文件所在项目的 formatter 配置。统一脚本优先使用 `web/node_modules/.bin/prettier`，不存在时使用 PATH 中的 Prettier；Ruff 和 shfmt 从 PATH 查找。执行前需安装相应工具。对应检查命令为 `ruff format --check`、`prettier --check`、`shfmt -i 2 -d`，其余参数和文件范围与写入时一致。

保留 JSON 锁文件中的版本和依赖信息，只调整排版。Dockerfile、Windows `.bat`、纯文本和二进制文件没有指定 formatter，不做机械排版。

## 新增文件类型

新增以下语言时，扩展 `tools/format.py` 的分组和检查模式，使用对应 formatter：

- Lua：`stylua <files>`，检查使用 `stylua --check <files>`。
- C / C++：`clang-format -i <files>`，检查使用 `clang-format --dry-run --Werror <files>`。
- TOML：`tombi format <files>`，检查使用 `tombi format --check <files>`。
- CMake：`cmake-format -i <files>`，检查使用 `cmake-format --check <files>`。

没有指定 formatter 的其他语言，使用支持该语言的语言服务器提供的格式化功能；如果没有可用的格式化能力，保留原格式。
