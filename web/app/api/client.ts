// API 客户端
import type {
  GetTVInfosRequest,
  GetTVInfosResponse,
  GetTVDetailsRequest,
  GetTVDetailsResponse,
  SetTVTagRequest,
  SearchTVRequest,
  SearchTVResponse,
  AddTVRequest,
  AddTVResponse,
  SetWatchProgressRequest,
  GetSeriesRequest,
  GetSeriesResponse,
  AddSeriesRequest,
  AddSeriesResponse,
  UpdateSeriesTVsRequest,
  GetDownloadProgressRequest,
  GetDownloadProgressResponse,
  GetErrorsRequest,
  GetErrorsResponse,
  RemoveErrorsRequest,
} from "./types";

// 基础 API 调用函数
async function apiCall<TRequest, TResponse>(
  endpoint: string,
  request: TRequest
): Promise<TResponse> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error: ${response.statusText} - ${errorText}`);
  }

  return response.json();
}

// 获取 TV 信息列表
export async function getTVInfos(
  request: GetTVInfosRequest
): Promise<GetTVInfosResponse> {
  return apiCall<GetTVInfosRequest, GetTVInfosResponse>(
    "/api/get_tv_infos",
    request
  );
}

// 获取 TV 详情
export async function getTVDetails(
  request: GetTVDetailsRequest
): Promise<GetTVDetailsResponse> {
  return apiCall<GetTVDetailsRequest, GetTVDetailsResponse>(
    "/api/get_tv_details",
    request
  );
}

// 设置 TV 标签
export async function setTVTag(
  request: SetTVTagRequest
): Promise<void> {
  await apiCall<SetTVTagRequest, void>("/api/set_tv_tag", request);
}

// 搜索 TV
export async function searchTV(
  request: SearchTVRequest
): Promise<SearchTVResponse> {
  return apiCall<SearchTVRequest, SearchTVResponse>(
    "/api/search_tv",
    request
  );
}

// 添加 TV
export async function addTV(request: AddTVRequest): Promise<AddTVResponse> {
  return apiCall<AddTVRequest, AddTVResponse>("/api/add_tv", request);
}

// 设置观看进度
export async function setWatchProgress(
  request: SetWatchProgressRequest
): Promise<void> {
  await apiCall<SetWatchProgressRequest, void>(
    "/api/set_watch_progress",
    request
  );
}

// 获取系列列表
export async function getSeries(
  request: GetSeriesRequest
): Promise<GetSeriesResponse> {
  return apiCall<GetSeriesRequest, GetSeriesResponse>(
    "/api/get_series",
    request
  );
}

// 添加系列
export async function addSeries(
  request: AddSeriesRequest
): Promise<AddSeriesResponse> {
  return apiCall<AddSeriesRequest, AddSeriesResponse>(
    "/api/add_series",
    request
  );
}

// 更新系列 TV 列表
export async function updateSeriesTVs(
  request: UpdateSeriesTVsRequest
): Promise<void> {
  await apiCall<UpdateSeriesTVsRequest, void>(
    "/api/update_series_tvs",
    request
  );
}

// 获取下载进度
export async function getDownloadProgress(
  request: GetDownloadProgressRequest = {}
): Promise<GetDownloadProgressResponse> {
  return apiCall<GetDownloadProgressRequest, GetDownloadProgressResponse>(
    "/api/get_download_progress",
    request
  );
}

// 获取错误列表
export async function getErrors(
  request: GetErrorsRequest = {}
): Promise<GetErrorsResponse> {
  return apiCall<GetErrorsRequest, GetErrorsResponse>(
    "/api/get_errors",
    request
  );
}

// 删除错误
export async function removeErrors(
  request: RemoveErrorsRequest
): Promise<void> {
  await apiCall<RemoveErrorsRequest, void>("/api/remove_errors", request);
}
