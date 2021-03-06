'use strict';


const MailParser = require('./mail-parser.js');

module.exports = (input, callback) => {
    let promise;
    if (!callback) {
        promise = new Promise((resolve, reject) => {
            callback = callbackPromise(resolve, reject);
        });
    }

    let mail = {
        attachments: []
    };

    let parser = new MailParser();

    parser.on('headers', headers => {
        mail.headers = headers;
    });

    parser.on('data', data => {
        if (data.type === 'text') {
            Object.keys(data).forEach(key => {
                if (['text', 'html', 'textAsHtml'].includes(key)) {
                    mail[key] = data[key];
                }
            });
        }

        if (data.type === 'attachment') {
            mail.attachments.push(data);

            let chunks = [];
            let chunklen = 0;
            data.content.on('readable', () => {
                let chunk;
                while ((chunk = data.content.read()) !== null) {
                    chunks.push(chunk);
                    chunklen += chunk.length;
                }
            });

            data.content.on('end', () => {
                data.content = Buffer.concat(chunks, chunklen);
                data.release();
            });
        }
    });

    parser.on('end', () => {
        ['subject', 'references', 'date', 'to', 'from', 'to', 'cc', 'bcc', 'message-id', 'in-reply-to', 'reply-to'].forEach(key => {
            if (mail.headers.has(key)) {
                mail[key.replace(/\-([a-z])/g, (m, c) => c.toUpperCase())] = mail.headers.get(key);
            }
        });

        parser.updateImageLinks((attachment, done) => done(false, 'data:' + attachment.contentType + ';base64,' + attachment.content.toString('base64')), (err, html) => {
            if (err) {
                return callback(err);
            }
            mail.html = html;

            callback(null, mail);
        });
    });

    if (typeof input === 'string') {
        parser.end(Buffer.from(input));
    } else if (Buffer.isBuffer(input)) {
        parser.end(input);
    } else {
        input.pipe(parser);
    }

    return promise;
};

function callbackPromise(resolve, reject) {
    return function (...args) {
        let err = args.shift();
        if (err) {
            reject(err);
        } else {
            resolve(...args);
        }
    };
}
