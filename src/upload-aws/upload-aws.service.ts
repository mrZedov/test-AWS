import { HttpException, Injectable } from '@nestjs/common';
import * as AWS from 'aws-sdk';
import * as sharp from 'sharp';

@Injectable()
export class UploadAWSService {
  SESConfig;
  convertibleImageSizes: number[];
  bucketsFolder: string;
  allowedMaxSize: number;
  allowedFileTypes: string[];
  s3: AWS.S3;

  onModuleInit() {
    // читаем конфиги
    this.SESConfig = {
      accessKeyId: process.env.AWS_ACCESS_ID,
      secretAccessKey: process.env.AWS_SECRET_KEY,
    };
    this.convertibleImageSizes = JSON.parse(
      process.env.CONVERTIBLE_IMAGE_SIZES,
    );
    this.bucketsFolder = process.env.BUCKETS_FOLDER;
    this.allowedMaxSize = Number(process.env.ALLOWED_MAX_SIZE);
    this.allowedFileTypes = JSON.parse(process.env.ALLOWED_FILE_TYPES);
    this.s3 = new AWS.S3(this.SESConfig);
  }

  async upload(req) {
    // определяем тип и размер файла по заголовкам
    // как вариант, размер можно самостоятельно подсчитывать при подписке:
    //  req.on('data', (chunk) => {
    //    тут суммировать длины 'chunk' и при превышении допустимого размера делать исключение
    //  })
    const contentType = req.headers['content-type'];
    const contentLength = Number(req.headers['content-length']);
    const imageType = contentType.match(/^image\/(.*)/)[1];

    // определяем шаблон имени файла на S3
    const fileName = +new Date();

    // проверяем файл на допустимый тип и размер. Если не удовлетворяет условиям, то выдаем исключение
    this.validateFile(imageType, contentLength);

    // создаем корзину на S3 если не была создана ранее
    await this.createBucketsFolder();

    const promises = [];
    const filesUploaded = [];
    for (const size of this.convertibleImageSizes) {
      const fullfilename = fileName + '-' + size + '.' + imageType;
      filesUploaded.push(fullfilename); // запоминаем имя каждого выгружаемого файла
      const promise = this.s3
        .upload({
          Bucket: this.bucketsFolder,
          Key: fullfilename,
          Body: req.pipe(sharp().resize(size, size)), // конвертируем в размер и отдаем поток на S3
        })
        .promise();
      promises.push(promise);
    }

    // ждем завершения выгрузки всех файлов на S3
    await Promise.all(promises).then(
      (data) => {},
      (err) => {
        console.log(err);
        throw new HttpException(err, 400);
      },
    );

    // возвращаем результаты успешной выгрузки
    return {
      result: 'File converted and uploaded to S3',
      code: 201,
      files: filesUploaded,
    };
  }

  validateFile(imageType: string, contentLength: number) {
    if (!this.allowedFileTypes.includes(imageType)) {
      throw new HttpException('Not allowed file type', 400);
    }
    if (contentLength > this.allowedMaxSize) {
      throw new HttpException('Not allowed size of file', 400);
    }
  }

  async createBucketsFolder() {
    const resListBuckets = await this.s3.listBuckets().promise();
    const basketUploadImagesFinverity = resListBuckets.Buckets.find(
      (el) => el.Name === this.bucketsFolder,
    );

    if (!basketUploadImagesFinverity) {
      await this.s3.createBucket({ Bucket: this.bucketsFolder }).promise();
    }
  }
}
