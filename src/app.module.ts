import { Module } from '@nestjs/common';
import { UploadAWSModule } from './upload-aws/upload-aws.module';

@Module({
  imports: [UploadAWSModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
