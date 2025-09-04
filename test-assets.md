# Asset Management System Test Plan

## Test Checklist

### Backend API Tests
- [x] GET /api/assets - List assets
- [x] POST /api/assets/upload - Upload new assets
- [x] GET /api/assets/:id - Get single asset
- [x] PUT /api/assets/:id - Update asset metadata
- [x] DELETE /api/assets/:id - Delete single asset
- [x] POST /api/assets/batch-delete - Batch delete assets
- [x] GET /api/assets/references - Get asset references for @mention
- [x] GET /api/assets/storage-info - Get storage usage info
- [x] POST /api/assets/generate-thumbnail - Generate thumbnail for asset
- [x] GET /api/assets/download/:id - Download asset file
- [x] POST /api/assets/get-signed-url - Get OSS signed URL

### Frontend Component Tests

#### AssetManager Component
- [ ] View asset list in grid layout
- [ ] Upload new assets via button
- [ ] Filter assets by type (image, document, other)
- [ ] Search assets by name
- [ ] Select/deselect assets
- [ ] Batch delete selected assets
- [ ] Preview asset on click
- [ ] Copy asset reference (@name)
- [ ] View storage usage info

#### AssetReferencePicker Component
- [ ] Trigger picker by typing @ in chat input
- [ ] Display recent assets
- [ ] Display all assets with type filters
- [ ] Search assets in picker
- [ ] Keyboard navigation (up/down arrows)
- [ ] Select asset with Enter key
- [ ] Close picker with Escape key
- [ ] Insert @reference into input field

#### PortfolioPage Integration
- [ ] Switch between "我的卡片" and "我的素材" tabs
- [ ] Asset tab shows AssetManager component
- [ ] Card tab shows FileManager component
- [ ] Tab state persists during session

#### ChatInputPanel Integration
- [ ] @ symbol triggers asset picker
- [ ] Asset picker appears at cursor position
- [ ] Selected asset reference inserted at @ position
- [ ] Cursor moves to end of inserted reference
- [ ] Multiple @references can be added
- [ ] References included in message when sent

## Test Scenarios

### Scenario 1: Upload and Reference Asset
1. Navigate to Portfolio page
2. Click "我的素材" tab
3. Click "上传素材" button
4. Select an image file
5. Wait for upload completion
6. Go back to chat
7. Type "@" in input field
8. Select the uploaded asset
9. Verify reference is inserted

### Scenario 2: Manage Assets
1. Upload multiple assets
2. Filter by "图片" type
3. Search for specific asset
4. Select multiple assets
5. Delete selected assets
6. Verify deletion success

### Scenario 3: Storage Quota
1. Check storage info display
2. Upload large file
3. Verify storage usage updates
4. Approach quota limit
5. Verify warning messages

## Known Issues to Check
- [x] Duplicate showTemplates declaration - FIXED
- [x] ES module/CommonJS compatibility - FIXED via wrapper
- [x] Docker build errors - FIXED
- [ ] Asset picker position calculation on mobile
- [ ] Large file upload progress indication
- [ ] Thumbnail generation for non-image files

## Success Criteria
- All backend endpoints return expected responses
- Frontend components render without errors
- Asset upload/delete operations work correctly
- @reference insertion works in chat input
- No console errors during normal usage
- UI is responsive on mobile devices