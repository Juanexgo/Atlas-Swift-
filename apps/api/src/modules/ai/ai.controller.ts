import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { AiService } from './ai.service';

@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Get('search')
  search(@Query('q') q = '', @Query('k') k = '8') {
    return this.ai.search(q, Number(k));
  }

  @Get('similar/:id')
  similar(@Param('id') id: string, @Query('k') k = '8') {
    return this.ai.similar(id, Number(k));
  }

  @Get('clusters')
  clusters(@Query('k') k?: string) {
    return this.ai.clusters(k ? Number(k) : undefined);
  }

  @Get('suggest')
  suggest() {
    return this.ai.suggest();
  }

  @Post('summarize/:id')
  async summarize(@Param('id') id: string): Promise<{ summary: string }> {
    return { summary: await this.ai.summarize(id) };
  }

  @Post('reindex')
  async reindex(): Promise<{ ok: true }> {
    await this.ai.rebuildIndex();
    return { ok: true };
  }
}
