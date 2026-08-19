import assert from 'node:assert/strict';
import test from 'node:test';
import { extractInboundText } from './whatsapp.service';

test('normaliza audio, imagem, figurinha e reacao para a conversa', () => {
  assert.deepEqual(extractInboundText({ type: 'audio', audio: { id: '1' } }), {
    type: 'audio', text: '🎧 Áudio recebido',
  });
  assert.deepEqual(extractInboundText({ type: 'image', image: { id: '2', caption: 'Veja isso' } }), {
    type: 'image', text: '🖼️ Veja isso',
  });
  assert.deepEqual(extractInboundText({ type: 'sticker', sticker: { id: '3' } }), {
    type: 'sticker', text: '🪄 Figurinha recebida',
  });
  assert.deepEqual(extractInboundText({ type: 'reaction', reaction: { emoji: '❤️', message_id: '4' } }), {
    type: 'reaction', text: '❤️ Reação à mensagem',
  });
});

test('mantem legenda de video e nome de documento', () => {
  assert.equal(extractInboundText({ type: 'video', video: { caption: 'Case' } }).text, '🎥 Case');
  assert.equal(extractInboundText({ type: 'document', document: { filename: 'proposta.pdf' } }).text, '📎 Documento recebido: proposta.pdf');
});
