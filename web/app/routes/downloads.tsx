import type { Route } from "./+types/downloads";

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "下载" },
    { name: "description", content: "下载进度管理" },
  ];
}

export default function Downloads() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">下载</h1>
      <p className="text-gray-500 dark:text-gray-400">待实现</p>
    </div>
  );
}
