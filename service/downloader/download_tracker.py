import time
from service.schema.downloader import DownloadProgress


class SpeedTracker:
    def __init__(self):
        self._records = []
        self._window_size: float = 60

    def add_bytes_downloaded(self, bytes_downloaded):
        current_time = time.time()
        self._records.append((current_time, bytes_downloaded))
        self._clean_old_records()

    def _clean_old_records(self):
        current_time = time.time()
        cutoff_time = current_time - self._window_size
        while self._records and self._records[0][0] < cutoff_time:
            self._records.pop(0)

    def get_speed(self) -> float:
        self._clean_old_records()
        if not self._records:
            return 0

        if len(self._records) == 1:
            return self._records[0][1] / self._window_size

        total_bytes = sum(record[1] for record in self._records[1:])
        time_span = self._records[-1][0] - self._records[0][0]

        return total_bytes / time_span


class SizeTracker:
    def __init__(self):
        self._records = []
        self._fragment_count = 0

    def set_fragment_count(self, count: int):
        self._fragment_count = count

    def add_fragment(self, size: float):
        self._records.append(size)

    def get_total_size(self) -> float:
        if len(self._records) == 0:
            return 0
        return sum(self._records) / len(self._records) * self._fragment_count


class DownloadTracker:
    def __init__(self):
        self.status = ""
        self.speed_tracker = SpeedTracker()
        self.size_tracker = SizeTracker()
        self.downloaded_size = 0

    def update(self, status: str):
        self.status = status

    def set_fragment_count(self, count: int):
        self.size_tracker.set_fragment_count(count)

    def add_fragment(self, size: float):
        self.size_tracker.add_fragment(size)

    def add_bytes_downloaded(self, bytes: int):
        self.downloaded_size += bytes
        self.speed_tracker.add_bytes_downloaded(bytes)

    def get_progress(self) -> DownloadProgress:
        return DownloadProgress(
            status=self.status,
            total_size=self.size_tracker.get_total_size(),
            downloaded_size=self.downloaded_size,
            speed=self.speed_tracker.get_speed(),
        )
