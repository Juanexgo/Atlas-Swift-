import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { GraphService } from './graph.service';
import {
  CreateEdgeDtoSchema,
  CreateNodeDtoSchema,
  UpdateNodeDtoSchema,
} from './dto';
import { z } from 'zod';
import type { AtlasEdge, AtlasNode } from '@atlas/types';

@Controller('graph')
export class GraphController {
  constructor(private readonly graph: GraphService) {}

  @Get('nodes')
  listNodes(): Promise<AtlasNode[]> {
    return this.graph.listNodes();
  }

  @Get('nodes/:id')
  getNode(@Param('id') id: string): Promise<AtlasNode> {
    return this.graph.getNode(id);
  }

  @Post('nodes')
  createNode(@Body() body: unknown): Promise<AtlasNode> {
    return this.graph.createNode(parseBody(CreateNodeDtoSchema, body));
  }

  @Patch('nodes/:id')
  updateNode(@Param('id') id: string, @Body() body: unknown): Promise<AtlasNode> {
    return this.graph.updateNode(id, parseBody(UpdateNodeDtoSchema, body));
  }

  @Delete('nodes/:id')
  deleteNode(@Param('id') id: string): Promise<void> {
    return this.graph.deleteNode(id);
  }

  @Get('edges')
  listEdges(): Promise<AtlasEdge[]> {
    return this.graph.listEdges();
  }

  @Post('edges')
  createEdge(@Body() body: unknown): Promise<AtlasEdge> {
    return this.graph.createEdge(parseBody(CreateEdgeDtoSchema, body));
  }

  @Delete('edges/:id')
  deleteEdge(@Param('id') id: string): Promise<void> {
    return this.graph.deleteEdge(id);
  }
}

function parseBody<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const r = schema.safeParse(body);
  if (!r.success) {
    throw new BadRequestException({ message: 'Invalid request', issues: r.error.issues });
  }
  return r.data;
}
