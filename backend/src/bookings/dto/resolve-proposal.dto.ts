import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsUUID } from 'class-validator';

export class ResolveProposalDto {
  @ApiProperty({ type: [String], description: 'IDs de los schedules a materializar (subconjunto de los candidatos)' })
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  selectedScheduleIds: string[];
}
