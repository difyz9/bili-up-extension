import { YoutubeTranscript, TranscriptItem } from './youtube-transcript';
import { BilibiliTranscript } from './bilibili-transcript';
import { SubtitleNormalizer } from './subtitle-normalizer';

export interface VideoData {
  platform: 'youtube' | 'bilibili';
  videoId: string;
  title: string;
  description?: string;
  duration?: number;
  uploader?: {
    name: string;
    id?: string;
  };
  url: string;
  thumbnailUrl?: string;
  tags?: string[];
}

export interface ExtractedSubtitles {
  title: string;
  language: string;
  languageCode: string;
  body: any[]; // 统一的字幕数据格式
  raw?: any; // 原始字幕数据
}

export class VideoDataExtractor {
  /**
   * 从当前页面提取视频数据和字幕
   */
  static async extractFromCurrentPage(): Promise<{
    videoData: VideoData;
    subtitles: ExtractedSubtitles;
  }> {
    const url = window.location.href;
    
    if (url.includes('youtube.com/watch') || url.includes('youtu.be/')) {
      return await this.extractYouTubeData(url);
    } else if (url.includes('bilibili.com/video/')) {
      return await this.extractBilibiliData(url);
    } else {
      throw new Error('不支持的视频平台');
    }
  }

  /**
   * 转换字幕格式为后端期望的格式
   */
  private static convertSubtitlesToBackendFormat(subtitles: any[], platform: string): Array<{
    text: string;
    duration: number;
    offset: number;
    lang: string;
  }> {
    if (!Array.isArray(subtitles) || subtitles.length === 0) {
      return [];
    }

    return subtitles.map((subtitle) => ({
      text: subtitle.text || subtitle.content || '',
      duration: subtitle.duration || (subtitle.to - subtitle.from) || 0,
      offset: subtitle.offset || subtitle.from || 0,
      lang: subtitle.lang || subtitle.languageCode || 'unknown'
    }));
  }

  /**
   * 提取 YouTube 视频数据和字幕
   */
  static async extractYouTubeData(url: string): Promise<{
    videoData: VideoData;
    subtitles: ExtractedSubtitles;
  }> {
    try {
      // 提取视频ID
      const videoId = YoutubeTranscript.retrieveVideoId(url);
      console.log(`[YouTube] 提取视频ID: ${videoId}`);

      // 从页面获取视频基本信息
      const videoData = this.getYouTubeVideoDataFromPage(videoId, url);

      // 获取字幕
      let subtitles: ExtractedSubtitles;
      try {
        const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);
        // 转换为后端期望的格式
        const backendFormatSubtitles = this.convertSubtitlesToBackendFormat(transcriptItems, 'youtube');
        
        subtitles = {
          title: `${videoData.title} - 字幕`,
          language: transcriptItems[0]?.lang || 'unknown',
          languageCode: transcriptItems[0]?.lang || 'unknown',
          body: backendFormatSubtitles,
          raw: transcriptItems
        };
        
        console.log(`[YouTube] 成功获取 ${backendFormatSubtitles.length} 条字幕`);
      } catch (error) {
        console.warn(`[YouTube] 字幕获取失败:`, error);
        subtitles = {
          title: '无字幕',
          language: '无',
          languageCode: 'none',
          body: []
        };
      }

      return { videoData, subtitles };
    } catch (error) {
      console.error('[YouTube] 数据提取失败:', error);
      throw new Error(`YouTube 数据提取失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 提取 Bilibili 视频数据和字幕
   */
  static async extractBilibiliData(url: string): Promise<{
    videoData: VideoData;
    subtitles: ExtractedSubtitles;
  }> {
    try {
      // 获取视频信息
      const videoInfo = await BilibiliTranscript.getCurrentVideoInfo();
      console.log(`[Bilibili] 获取视频信息:`, videoInfo);

      const videoData: VideoData = {
        platform: 'bilibili',
        videoId: videoInfo.bvid,
        title: videoInfo.title,
        description: videoInfo.description,
        duration: videoInfo.duration,
        uploader: {
          name: videoInfo.uploader.name,
          id: videoInfo.uploader.mid
        },
        url: url,
        thumbnailUrl: `https://i0.hdslb.com/bfs/archive/${videoInfo.bvid}.jpg`
      };

      // Bilibili视频不获取字幕，只获取基本视频信息
      const subtitles: ExtractedSubtitles = {
        title: '不获取Bilibili字幕',
        language: '不适用',
        languageCode: 'none',
        body: []
      };
      
      console.log(`[Bilibili] 跳过字幕获取，仅获取视频基本信息`);

      return { videoData, subtitles };
    } catch (error) {
      console.error('[Bilibili] 数据提取失败:', error);
      throw new Error(`Bilibili 数据提取失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 从页面获取 YouTube 视频基本信息
   */
  private static getYouTubeVideoDataFromPage(videoId: string, url: string): VideoData {
    let title = '';
    let description = '';
    let uploader = { name: '', id: '' };
    let duration = 0;

    try {
      // 尝试从页面标题获取视频标题
      const titleElement = document.querySelector('meta[property="og:title"]') as HTMLMetaElement;
      if (titleElement) {
        title = titleElement.content;
      }

      // 尝试从meta标签获取描述
      const descElement = document.querySelector('meta[property="og:description"]') as HTMLMetaElement;
      if (descElement) {
        description = descElement.content;
      }

      // 尝试获取频道信息
      const channelElement = document.querySelector('ytd-channel-name a, .ytd-video-owner-renderer a');
      if (channelElement) {
        uploader.name = channelElement.textContent?.trim() || '';
      }

      // 如果页面方法失败，使用后备方案
      if (!title) {
        title = document.title.replace(' - YouTube', '') || `YouTube Video ${videoId}`;
      }
    } catch (error) {
      console.warn('[YouTube] 从页面提取信息失败，使用默认值:', error);
      title = `YouTube Video ${videoId}`;
    }

    return {
      platform: 'youtube',
      videoId,
      title,
      description,
      duration,
      uploader,
      url,
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
    };
  }

  /**
   * 验证提取的数据
   */
  static validateVideoData(videoData: VideoData, subtitles: ExtractedSubtitles): boolean {
    if (!videoData.videoId || !videoData.title || !videoData.platform) {
      console.error('视频数据不完整:', videoData);
      return false;
    }

    if (!subtitles.languageCode) {
      console.warn('字幕数据不完整，但允许无字幕情况');
    }

    return true;
  }
}