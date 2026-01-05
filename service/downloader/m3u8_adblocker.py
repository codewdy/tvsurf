import asyncio
import av
import dataclasses
import hashlib
from service.lib.context import Context
from service.schema.downloader import AdBlockDB


@dataclasses.dataclass
class TSFingerPrint:
    md5: str = ""
    time_base: int = 0
    duration: int = 0
    width: int = 0
    height: int = 0
    filtered: bool = False
    parse_error: bool = False

    def finger_print_tuple(self):
        return self.time_base, self.duration, self.width, self.height


class M3U8AdBlocker:
    async def process_lines(self, lines):
        if Context.has_data("db"):
            adblock_db = Context.data("db").manage("adblock_db", AdBlockDB)
        else:
            adblock_db = None
            Context.set_data("adblock_db", adblock_db)
        lines = list(lines)
        ts = []
        for i, line in enumerate(lines):
            if line.startswith("#"):
                continue
            ts.append(i)

        loop = asyncio.get_running_loop()
        finger_prints = await loop.run_in_executor(
            None, self.get_finger_prints, [lines[t].strip() for t in ts]
        )

        parse_error_count = sum([1 if fp.parse_error else 0 for fp in finger_prints])
        if parse_error_count >= 3:
            raise ValueError(
                f"too many parse error in ad block.(parse_error_count={parse_error_count})"
            )

        finger_print_count = {}
        for fp in finger_prints:
            if fp.parse_error:
                continue
            if fp.finger_print_tuple() not in finger_print_count:
                finger_print_count[fp.finger_print_tuple()] = 0
            finger_print_count[fp.finger_print_tuple()] += 1

        main_finger_print = max(finger_print_count, key=lambda k: finger_print_count[k])

        if adblock_db is not None:
            ts_black_list = adblock_db.ts_black_list
            for t, fp in zip(ts, finger_prints):
                if fp.parse_error:
                    continue
                if fp.md5 in ts_black_list:
                    lines[t] = "#" + lines[t]
                    fp.filtered = True
                if (
                    fp.finger_print_tuple() != main_finger_print
                    and str(t) not in ts_black_list
                ):
                    lines[t] = "#" + lines[t]
                    fp.filtered = True
                    ts_black_list.add(fp.md5)
                    adblock_db.commit()
        else:
            for t, fp in zip(ts, finger_prints):
                if fp.parse_error:
                    continue
                if fp.finger_print_tuple() != main_finger_print:
                    lines[t] = "#" + lines[t]
                    fp.filtered = True

        return lines

    async def process_file(self, file):
        with open(file, "r") as f:
            lines = f.readlines()
        lines = await self.process_lines(lines)
        with open(file, "w") as f:
            f.writelines(lines)

    def get_finger_prints(self, files):
        return [self.get_finger_print(file) for file in files]

    def get_finger_print(self, file):
        rst = TSFingerPrint()
        try:
            avfile = av.open(file)
            with avfile as container:
                in_stream = container.streams.video[0]
                for packet in container.demux(in_stream):  # type: ignore
                    if packet.dts is None:
                        continue
                    rst.time_base = int(1 / in_stream.time_base)  # type: ignore
                    rst.duration = packet.duration  # type: ignore
                    rst.width = in_stream.codec_context.width
                    rst.height = in_stream.codec_context.height
                    break
            rst.md5 = hashlib.md5(open(file, "rb").read()).hexdigest()
            return rst
        except:
            rst.parse_error = True
            return rst
