import { HttpException, Injectable } from '@nestjs/common';
import * as AWS from 'aws-sdk';
import * as sharp from 'sharp';

@Injectable()
export class UploadAWSService {
  async upload(req) {
    
    // читаем конфиг
    const SESConfig = {
      accessKeyId: process.env.AWS_ACCESS_ID,
      secretAccessKey: process.env.AWS_SECRET_KEY,
    };
    const convertibleImageSizes = JSON.parse(
      process.env.CONVERTIBLE_IMAGE_SIZES,
    );
    const bucketsFolder = process.env.BUCKETS_FOLDER;

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

    var s3: AWS.S3 = new AWS.S3(SESConfig);

    // создаем корзину на S3 если не была создана ранее
    await this.createBucketsFolder(s3, bucketsFolder);

    const promises = [];
    const filesUploaded = [];
    for (const size of convertibleImageSizes) {
      const fullfilename = fileName + '-' + size + '.' + imageType;
      filesUploaded.push(fullfilename); // запоминаем имя каждого выгружаемого файла
      const promise = s3
        .upload({
          Bucket: bucketsFolder,
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
    const allowedMaxSize = Number(process.env.ALLOWED_MAX_SIZE);
    const allowedFileTypes = JSON.parse(process.env.ALLOWED_FILE_TYPES);
    if (!allowedFileTypes.includes(imageType)) {
      throw new HttpException('Not allowed file type', 400);
    }
    if (contentLength > allowedMaxSize) {
      throw new HttpException('Not allowed size of file', 400);
    }
  }

  async createBucketsFolder(s3: AWS.S3, bucketsFolder: string) {
    const resListBuckets = await s3.listBuckets().promise();
    const basketUploadImagesFinverity = resListBuckets.Buckets.find(
      (el) => el.Name === bucketsFolder,
    );

    if (!basketUploadImagesFinverity) {
      await s3.createBucket({ Bucket: bucketsFolder }).promise();
    }
  }
}
