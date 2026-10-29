import test from 'node:test';
import assert from 'node:assert/strict';
import { galleryCardHtml } from '../../resources/js/gallery.js';

test('every uploaded gallery card has a like button and its own comment form', () => {
    const html = galleryCardHtml({ id: 'new-post', caption: 'Entreno', description: 'Equipo', mediaUrl: 'https://example.com/photo.jpg' });
    assert.match(html, /data-gallery-like/);
    assert.match(html, /data-post-id="new-post"/);
    assert.match(html, /data-inline-comment/);
    assert.match(html, /data-comment-list="new-post"/);
});
