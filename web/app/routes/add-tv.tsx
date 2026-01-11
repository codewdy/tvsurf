import type { Route } from "./+types/add-tv";

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "添加TV" },
    { name: "description", content: "搜索并添加新的TV" },
  ];
}

export default function AddTV() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">添加TV</h1>
      <p className="text-gray-500 dark:text-gray-400">待实现</p>
    </div>
  );
}
