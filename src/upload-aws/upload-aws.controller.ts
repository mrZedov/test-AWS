import { Controller, Post, Req } from '@nestjs/common';
import { UploadAWSService } from './upload-aws.service';

@Controller()
export class UploadAWSController {
  constructor(private readonly uploadAWSService: UploadAWSService) {}

  @Post()
  async upload(@Req() req) {
    return this.uploadAWSService.upload(req);
  }
}
