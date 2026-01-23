import type { Tag } from '../api/types';

// Tag 显示名称映射
export const TAG_NAMES: Record<Tag, string> = {
    watching: '在看',
    wanted: '想看',
    watched: '看完',
    on_hold: '搁置',
    not_tagged: '未标记',
};

// 获取标签名称
export function getTagName(tag: string): string {
    return TAG_NAMES[tag as Tag] || tag;
}
