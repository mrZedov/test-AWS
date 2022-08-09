import { Module } from '@nestjs/common';
import { UploadAWSController } from './upload-aws.controller';
import { UploadAWSService } from './upload-aws.service';

@Module({
  imports: [],
  controllers: [UploadAWSController],
  providers: [UploadAWSService],
})
export class UploadAWSModule {}
