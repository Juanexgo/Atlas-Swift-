import { Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { YDocStore } from './ydoc.store';

@Module({
  providers: [RealtimeGateway, YDocStore],
})
export class RealtimeModule {}
