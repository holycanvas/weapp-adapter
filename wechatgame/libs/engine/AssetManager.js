const cacheManager = require('../cache-manager');
const { downloadFile, readText, readArrayBuffer, readJson, loadSubpackage, readJsonSync } = require('../wx-utils');

const REGEX = /^\w+:\/\/.*/;

const downloader = cc.assetManager.downloader;
const isSubDomain = cc.sys.platform === cc.sys.WECHAT_GAME_SUB;
downloader.limitations[cc.AssetManager.LoadStrategy.NORMAL] = { maxConcurrent: 10, maxRequestsPerFrame: 10 };
var subpackages = new cc.AssetManager.Cache();

function downloadScript (url, options, onComplete) {
    if (typeof options === 'function') {
        onComplete = options;
        options = null;
    }
    require('../../' + url);
    onComplete && onComplete(null);
}

function unsupported (url, options, onComplete) {
    onComplete(new Error(cc.debug.getError(4927)));
}

function loadFont (url, options, onComplete) {
    var fontFamily = wx.loadFont(url);
    onComplete(null, fontFamily || 'Arial');
}

function downloadDomAudio (url, options, onComplete) {
    if (typeof options === 'function') {
        onComplete = options;
        options = null;
    }
    var dom = document.createElement('audio');
    dom.src = url;
    onComplete(null, dom);
}

function readFile(filePath, options, onComplete) {
    switch (options.responseType) {
        case 'json': 
            readJson(filePath, onComplete);
            break;
        case 'arraybuffer':
            readArrayBuffer(filePath, onComplete);
            break;
        default:
            readText(filePath, onComplete);
            break;
    }
}

function download (url, func, options, onProgress, onComplete) {
    var result = transformUrl(url, options);
    if (result.inLocal || isSubDomain) {
        func(result.url, options, onComplete);
    }
    else if (result.inCache) {
        cacheManager.updateLastTime(url)
        func(result.url, options, onComplete);
    }
    else {
        var task = downloadFile(url, null, options.header, function (err, path) {
            if (err) {
                onComplete(err, null);
                return;
            }
            func(path, options, function (err, data) {
                if (!err) {
                    cacheManager.tempFiles.add(url, path);
                    cacheManager.cacheFile(url, path, options.saveFile, true);
                }
                onComplete(err, data);
            });
        });
        onProgress && task.onProgressUpdate(onProgress);
    }
}

function downloadJson (url, options, onComplete) {
    options.responseType = "json";
    download(url, readFile, options, options.onProgress, onComplete);
}

function downloadArrayBuffer (url, options, onComplete) {
    options.responseType = "arraybuffer";
    download(url, readFile, options, options.onProgress, onComplete);
}

function downloadText (url, options, onComplete) {
    options.responseType = "text";
    download(url, readFile, options, options.onProgress, onComplete);
}

function downloadAudio (url, options, onComplete) {
    download(url, downloadDomAudio, options, options.onProgress, onComplete);
}

function downloadFont (url, options, onComplete) {
    download(url, loadFont, options, options.onProgress, onComplete);
}

function downloadImage (url, options, onComplete) {
    download(url, downloader.downloadDomImage, options, options.onProgress, onComplete);
}

function downloadImageInAndroid (url, options, onComplete) {
    var result = transformUrl(url, options);
    if (result.inLocal || isSubDomain) {
        downloader.downloadDomImage(result.url, options, onComplete);
    }
    else if (result.inCache) {
        cacheManager.updateLastTime(url)
        downloader.downloadDomImage(result.url, options, onComplete);
    }
    else {
        downloader.downloadDomImage(url, options, function (err, img) {
            if (!err) {
                cacheManager.cacheFile(url, url, options.saveFile, false);
            }
            onComplete(err, img);
        });
    }
}

downloadImage = cc.sys.os === cc.sys.OS_ANDROID ? downloadImageInAndroid : downloadImage;

var downloadWebp = cc.sys.capabilities.webp ? downloadImage : unsupported;

downloader.downloadDomAudio = downloadDomAudio;
downloader.downloadScript = downloadScript;

downloader.register({
    '.js' : downloadScript,

    // Audio
    '.mp3' : downloadAudio,
    '.ogg' : downloadAudio,
    '.wav' : downloadAudio,
    '.m4a' : downloadAudio,

    // Image
    '.png' : downloadImage,
    '.jpg' : downloadImage,
    '.bmp' : downloadImage,
    '.jpeg' : downloadImage,
    '.gif' : downloadImage,
    '.ico' : downloadImage,
    '.tiff' : downloadImage,
    '.image' : downloadImage,
    '.webp' : downloadWebp,
    '.pvr': downloadArrayBuffer,
    '.pkm': downloadArrayBuffer,

    '.font': downloadFont,
    '.eot': downloadFont,
    '.ttf': downloadFont,
    '.woff': downloadFont,
    '.svg': downloadFont,
    '.ttc': downloadFont,

    // Txt
    '.txt' : downloadText,
    '.xml' : downloadText,
    '.vsh' : downloadText,
    '.fsh' : downloadText,
    '.atlas' : downloadText,

    '.tmx' : downloadText,
    '.tsx' : downloadText,

    '.json' : downloadJson,
    '.ExportJson' : downloadJson,
    '.plist' : downloadText,

    '.fnt' : downloadText,

    '.binary' : downloadArrayBuffer,
    '.bin': downloadArrayBuffer,
    '.dbbin': downloadArrayBuffer,
});

function transformUrl (url, options) {
    var inLocal = false;
    var inCache = false;
    if (REGEX.test(url)) {
        var cache = cacheManager.cachedFiles.get(url);
        if (!options.reload && cache) {
            inCache = true;
            url = cache.url;
        }
        else {
            var tempUrl = cacheManager.tempFiles.get(url);
            if (tempUrl) { 
                inLocal = true;
                url = tempUrl;
            }
        }
    }
    else {
        inLocal = true;
        if (isSubDomain) {
            url = SUBCONTEXT_ROOT + '/' + url;
        }
    }
    return { url, inLocal, inCache };
}

cc.assetManager._transformPipeline.append(function (task) {
    var input = task.output = task.input;
    for (var i = 0, l = input.length; i < l; i++) {
        var item = input[i];
        var options = item.options;
        if (!item.config) options.saveFile = options.saveFile !== undefined ? options.saveFile : false;
    }
});

cc.assetManager.loadBundle = function (root, options, onComplete) {
    if (typeof options === 'function') {
        onComplete = options;
        options = null;
    }
    options = options || {};
    var config = options.ver ? `${root}/config.${options.ver}.json` : `${root}/config.json`;
    if (subpackages.has(root)) {
        loadSubpackage(root, options.onProgress, function (err) {
            if (err) {
                onComplete && onComplete(err, null);
                return;
            }
            downloadJson(config, options, function (err, json) {
                var bundle = null;
                if (!err) {
                    bundle = new cc.AssetManager.Bundle();
                    json.base = root + '/';
                    bundle.init(json);
                }
                onComplete && onComplete(err, bundle);
            });
        });
    }
    else {
        downloadJson(config, options, function (err, json) {
            var bundle = null;
            if (!err) {
                bundle = new cc.AssetManager.Bundle();
                json.base = root + '/';
                bundle.init(json);
            }
            onComplete && onComplete(err, bundle);
        });
    }
    
};
var originInit = cc.assetManager.init;
cc.assetManager.init = function (options) {
    originInit.call(cc.assetManager, options);
    cacheManager.init();
};

var content = readJsonSync('game.json');
if (content.subpackages) {
    for (var i = 0, l = content.subpackages.length; i < l; i++) {
        subpackages.add(content.subpackages[i].root, content.subpackages[i]);
    }
}