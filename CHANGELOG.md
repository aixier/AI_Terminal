# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [v1.0.0-transcription] - 2025-01-09

### Added
- Complete audio/video transcription service integration
- Aliyun OSS (Object Storage Service) integration for media file storage
- Aliyun SenseVoice API integration for speech recognition
- Asynchronous task processing with real-time progress tracking
- Batch file transcription support
- Timestamped output generation in Markdown format
- SRT subtitle file generation
- Comprehensive REST API for transcription operations
- Task management system with status tracking
- Support for multiple audio formats (WAV, MP3, M4A, AAC, OPUS, FLAC, OGG, AMR)
- Support for multiple video formats (MP4, MOV, AVI, MKV, WMV, FLV, WebM)
- Multipart upload for large files (>10MB)
- Signed URL generation for secure file access
- Automatic file cleanup and retention policies

### Documentation
- OSS service usage guide with examples
- SenseVoice service integration guide
- Complete transcription API documentation with sequence diagrams
- Environment configuration examples (.env.example)
- Project README with quick start guide

### Security
- Environment variable configuration for sensitive data
- .gitignore updated to exclude API keys and credentials
- Signed URLs for temporary file access
- No hardcoded credentials in codebase

### Technical Details
- Port changed from 6000 to 6009 to avoid conflicts
- ES modules and CommonJS compatibility resolved
- File structure organized for clarity and maintainability
- Test scripts for end-to-end validation

## [Unreleased]

### Planned
- Frontend UI for transcription service
- Real-time streaming transcription
- WebSocket support for live updates
- Additional language support
- Speaker diarization
- Custom vocabulary support
- Export to more subtitle formats (VTT, ASS, etc.)
- Integration with video editing tools
- Performance optimizations for large batch processing

---

## Version History

- **v1.0.0-transcription** (2025-01-09): Initial release with complete transcription service
- **v0.x.x**: Development versions (not tagged)

## Links

- [GitHub Repository](https://github.com/aixier/AI_Terminal)
- [Release Notes](https://github.com/aixier/AI_Terminal/releases)
- [Documentation](./terminal-backend/docs/)