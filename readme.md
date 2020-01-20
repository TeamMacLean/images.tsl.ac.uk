# images.tsl.ac.uk
> TSL microscopy image file and metadata storage system.

## Help
* To change the upload limit modify `public/src/uploader:maxFileSize` to be `LIMIT_IN_GB * 1000 * 1000000`. You will also need to modify the reverse proxy (if used), on the tsl server this can be found in `/etc/nginx/conf.d/`
* 