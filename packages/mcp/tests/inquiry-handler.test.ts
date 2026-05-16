/**
 * MCP Inquiry Handler Tests
 *
 * Tests for Thai ticker normalization and inquiry tool functions
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeThaiTicker,
  getInquiryTools,
  handleAsk,
  handleListThaiTickers,
} from '../src/modules/inquiry-handler.js';

describe('MCP inquiry-handler', () => {
  describe('normalizeThaiTicker', () => {
    it('should add .BK suffix to CPALL', () => {
      expect(normalizeThaiTicker('CPALL')).toBe('CPALL.BK');
    });

    it('should add .BK suffix to DELTA', () => {
      expect(normalizeThaiTicker('DELTA')).toBe('DELTA.BK');
    });

    it('should add .BK suffix to ADVANC', () => {
      expect(normalizeThaiTicker('ADVANC')).toBe('ADVANC.BK');
    });

    it('should add .BK suffix to lowercase cpall', () => {
      expect(normalizeThaiTicker('cpall')).toBe('CPALL.BK');
    });

    it('should not add .BK to US tickers', () => {
      expect(normalizeThaiTicker('AAPL')).toBe('AAPL');
      expect(normalizeThaiTicker('MSFT')).toBe('MSFT');
      expect(normalizeThaiTicker('TSLA')).toBe('TSLA');
    });

    it('should not double-add .BK suffix', () => {
      expect(normalizeThaiTicker('CPALL.BK')).toBe('CPALL.BK');
      expect(normalizeThaiTicker('DELTA.BK')).toBe('DELTA.BK');
    });

    it('should handle all 48 Thai tickers', () => {
      const thaiTickers = [
        'ACP', 'ADVANC', 'AOT', 'BDMS', 'BBL', 'BCP', 'BGH', 'BTS', 'CBG', 'CPALL',
        'CPF', 'CPN', 'DELTA', 'DTAC', 'EA', 'EGCO', 'EP', 'GULF', 'HMPRO', 'INTUCH',
        'IRPC', 'IVL', 'JAS', 'KBANK', 'KCE', 'KTC', 'LH', 'MINT', 'MTC', 'OR',
        'OSP', 'PTT', 'PTTEP', 'PTTGC', 'RATCH', 'SAWAD', 'SCC', 'STA',
        'TIDLOR', 'TISCO', 'TKC', 'TMB', 'TOP', 'TRUE', 'TU', 'VGI', 'WHA', 'WII'
      ];

      for (const ticker of thaiTickers) {
        const normalized = normalizeThaiTicker(ticker);
        expect(normalized).toContain('.BK');
        expect(normalized).toBe(ticker.toUpperCase() + '.BK');
      }
    });
  });

  describe('getInquiryTools', () => {
    it('should return ask tool definition', () => {
      const tools = getInquiryTools();

      expect(tools.length).toBe(2);
      const askTool = tools.find(t => t.name === 'ask');
      expect(askTool).toBeDefined();
      expect(askTool?.inputSchema?.properties?.ticker).toBeDefined();
      expect(askTool?.inputSchema?.properties?.question).toBeDefined();
    });

    it('should return list_thai_tickers tool definition', () => {
      const tools = getInquiryTools();

      const listTool = tools.find(t => t.name === 'list_thai_tickers');
      expect(listTool).toBeDefined();
    });
  });

  describe('handleAsk', () => {
    it('should normalize Thai ticker in request', async () => {
      const result = await handleAsk({
        ticker: 'CPALL',
        question: 'What is the fair value?',
      });

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      const text = result.content[0].text;
      expect(text).toContain('CPALL.BK');
    });

    it('should handle English question', async () => {
      const result = await handleAsk({
        ticker: 'AAPL',
        question: 'What are the key risks?',
      });

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
    });
  });

  describe('handleListThaiTickers', () => {
    it('should return list of Thai tickers', async () => {
      const result = await handleListThaiTickers();

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      const text = result.content[0].text;
      expect(text).toContain('CPALL');
      expect(text).toContain('DELTA');
      expect(text).toContain('48');
    });
  });
});
