/**
 * 前后端数据格式对照测试
 * 
 * 前端提交的数据格式 (VideoSubmissionData):
 * {
 *   platform: 'youtube' | 'bilibili',
 *   video_id: string,
 *   title: string,
 *   description?: string,
 *   duration?: number,
 *   uploader_name?: string,
 *   uploader_id?: string,
 *   url: string,
 *   thumbnail_url?: string,
 *   subtitles?: {
 *     title: string,
 *     language: string,
 *     language_code: string,
 *     content: Array<{
 *       text: string,
 *       duration: number,
 *       offset: number,
 *       lang: string
 *     }>
 *   },
 *   timestamp?: string,
 *   source?: string
 * }
 * 
 * 后端期望的数据格式 (SaveVideoRequest):
 * {
 *   url: string (required),
 *   title: string,
 *   description: string,
 *   operationType: string,
 *   subtitles: Array<{
 *     text: string,
 *     duration: number,
 *     offset: number,
 *     lang: string
 *   }>,
 *   playlistId: string,
 *   timestamp: string,
 *   savedAt: string
 * }
 * 
 * 数据转换映射:
 * - url ← url (直接映射)
 * - title ← title (直接映射)
 * - description ← description (直接映射)
 * - operationType ← 固定值 'submit_from_extension'
 * - subtitles ← subtitles.content (数组内容直接映射)
 * - playlistId ← 空字符串 (默认值)
 * - timestamp ← timestamp || 当前时间
 * - savedAt ← 当前时间
 */

// 这是一个文档文件，用于说明前后端数据格式的对应关系
// 实际的转换逻辑在 /utils/api.ts 的 submitVideoData 方法中实现

export const DATA_FORMAT_MAPPING = {
  FRONTEND_TO_BACKEND: {
    'url': 'url',
    'title': 'title', 
    'description': 'description',
    'subtitles.content': 'subtitles',
    'timestamp': 'timestamp',
    'fixed_operationType': 'submit_from_extension',
    'fixed_playlistId': '',
    'current_time': 'savedAt'
  },
  
  SUBTITLE_FORMAT: {
    'text': 'string - 字幕文本',
    'duration': 'number - 持续时间(秒)',
    'offset': 'number - 开始时间(秒)', 
    'lang': 'string - 语言代码'
  },
  
  BACKEND_RESPONSE_FORMAT: {
    'success': 'boolean - 是否成功',
    'message': 'string - 响应消息',
    'data': {
      'id': 'number - 视频记录ID',
      'title': 'string - 视频标题',
      'operationType': 'string - 操作类型',
      'subtitleCount': 'number - 字幕数量',
      'isExisting': 'boolean - 是否为更新记录'
    }
  }
};

export default DATA_FORMAT_MAPPING;