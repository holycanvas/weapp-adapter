const cacheManager = require('../cache-manager');
const { downloadFile, readText, readArrayBuffer, readJson, loadSubpackage, readJsonSync } = require('../fs-utils');

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
    if (REGEX.test(url)) {
        onComplete && onComplete(new Error('wechat does not support loading remote scripts'));
    }
    else {
        require('../../' + url);
        onComplete && onComplete(null);
    }
}

function unsupported (url, options, onComplete) {
    onComplete(new Error(cc.debug.getError(4927)));
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
    if (result.inLocal) {
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

var downloadJson = !isSubDomain ? function (url, options, onComplete) {
    options.responseType = "json";
    download(url, readFile, options, options.onProgress, onComplete);
} : function subdomainDownloadJson (url, options, onComplete) {
    var content = require('../../' + cc.path.changeExtname(url, '.js'));
    onComplete && onComplete(null, content);
}

var loadFont = !isSubDomain ? function (url, options, onComplete) {
    var fontFamily = wx.loadFont(url);
    onComplete(null, fontFamily || 'Arial');
} : function (url, options, onComplete) {
    onComplete(null, 'Arial');
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

function downloadVideo (url, options, onComplete) {
    download(url, function (url, options, onComplete) { onComplete(null, url); }, options, options.onProgress, onComplete);
}

function downloadFont (url, options, onComplete) {
    download(url, loadFont, options, options.onProgress, onComplete);
}

function downloadImage (url, options, onComplete) {
    download(url, downloader.downloadDomImage, options, options.onProgress, onComplete);
}

function subdomainDownloadImage (url, options, onComplete) {
    var { url } = transformUrl(url, options);
    downloader.downloadDomImage(url, options, onComplete);
}

function downloadImageInAndroid (url, options, onComplete) {
    var result = transformUrl(url, options);
    if (result.inLocal) {
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

downloadImage = isSubDomain ? subdomainDownloadImage : (cc.sys.os === cc.sys.OS_ANDROID ? downloadImageInAndroid : downloadImage);

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

    '.mp4': downloadVideo,
    '.avi': downloadVideo,
    '.mov': downloadVideo,
    '.mpg': downloadVideo,
    '.mpeg': downloadVideo,
    '.rm': downloadVideo,
    '.rmvb': downloadVideo,
});

var transformUrl = !isSubDomain ? function (url, options) {
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
    }
    return { url, inLocal, inCache };
} : function (url, options) {
    if (!REGEX.test(url)) {
        url = SUBCONTEXT_ROOT + '/' + url;
    }
    return { url };
}

cc.assetManager.loadBundle = function (root, options, onComplete) {
    if (typeof options === 'function') {
        onComplete = options;
        options = null;
    }
    options = options || {};
    options.priority = options.priority || 2;
    var config = options.ver ? `${root}/config.${options.ver}.json` : `${root}/config.json`;
    if (subpackages.has(root)) {
        loadSubpackage(root, options.onProgress, function (err) {
            if (err) {
                onComplete && onComplete(err, null);
                return;
            }
            downloader.download(root, config, '.json', options, function (err, json) {
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
        downloader.download(root, config, '.json', options, function (err, json) {
            if (!err) {
                var bundle = new cc.AssetManager.Bundle();
                json.base = root + '/';
                bundle.init(json);
                if (!json.scripts) return onComplete && onComplete(null, bundle);
                cc.assetManager.loadScript(root + '/index.js', options, function (err) {
                    onComplete && onComplete(null, bundle);
                });
                return;
            }
            onComplete && onComplete(err, null);
        });
    }
    
};

if (!isSubDomain) {
    cc.assetManager._transformPipeline.append(function (task) {
        var input = task.output = task.input;
        for (var i = 0, l = input.length; i < l; i++) {
            var item = input[i];
            var options = item.options;
            if (!item.config) options.saveFile = options.saveFile !== undefined ? options.saveFile : false;
        }
    });

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
}



