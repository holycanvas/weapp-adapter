/****************************************************************************
 Copyright (c) 2017-2019 Xiamen Yaji Software Co., Ltd.

 https://www.cocos.com/

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of wxUtils software and associated engine source code (the "Software"), a limited,
  worldwide, royalty-free, non-assignable, revocable and non-exclusive license
 to use Cocos Creator solely to develop games on your target platforms. You shall
  not use Cocos Creator software for developing other software or tools that's
  used for developing games. You are not granted to publish, distribute,
  sublicense, and/or sell copies of Cocos Creator.

 The software or tools in wxUtils License Agreement are licensed, not sold.
 Xiamen Yaji Software Co., Ltd. reserves all rights not expressly granted to you.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 ****************************************************************************/

var wxUtils = {

    fs: wx.getFileSystemManager ? wx.getFileSystemManager() : null,

    checkFsValid () {
        if (!wxUtils.fs) {
            console.warn('can not get the file system!');
            return false;
        }
        return true;
    },

    deleteFile (filePath, onComplete) {
        wxUtils.fs.unlink({
            filePath: filePath,
            success: function () {
                onComplete && onComplete(null);
            },
            fail: function (res) {
                cc.warn('Delete file failed: ' + res.errMsg);
                onComplete && onComplete(new Error(res.errMsg));
            }
        });
    },

    downloadFile (remoteUrl, filePath, header, onComplete) {
        var options = {
            url: remoteUrl,
            success: function (res) {
                if (res.statusCode === 200) {
                    onComplete && onComplete(null, res.tempFilePath || res.filePath);
                }
                else {
                    if (res.filePath) {
                        deleteFile(res.filePath);
                    }
                    cc.warn('Download file failed: ' + res.errMsg);
                    onComplete && onComplete(new Error(res.errMsg), null);
                }
            },
            fail: function (res) {
                cc.warn('Download file failed: ' + res.errMsg);
                onComplete && onComplete(new Error(res.errMsg), null);
            }
        }
        if (filePath) options.filePath = filePath;
        if (header) options.header = header;
        return wx.downloadFile(options);
    },

    saveFile (srcPath, destPath, onComplete) {
        wx.saveFile({
            tempFilePath: srcPath,
            filePath: destPath,
            success: function (res) {
                onComplete && onComplete(null);
            },
            fail: function (res) {
                cc.warn('Save file failed: ' + res.errMsg);
                onComplete && onComplete(new Error(res.errMsg));
            }
        });
    },

    copyFile (srcPath, destPath, onComplete) {
        wxUtils.fs.copyFile({
            srcPath: srcPath,
            destPath: destPath,
            success: function () {
                onComplete && onComplete(null);
            },
            fail: function (res) {
                cc.warn('Copy file failed: ' + res.errMsg);
                onComplete && onComplete(new Error(res.errMsg));
            }
        });
    },

    writeFile (path, data, encoding, onComplete) {
        wxUtils.fs.writeFile({
            filePath: path,
            encoding: encoding,
            data: data,
            success: function () {
                onComplete && onComplete(null);
            },
            fail: function (res) {
                cc.warn('Write file failed: ' + res.errMsg);
                onComplete && onComplete(new Error(res.errMsg));
            }
        });
    },

    writeFileSync (path, data, encoding) {
        try {
            wxUtils.fs.writeFileSync(path, data, encoding);
            return null;
        }
        catch (e) {
            cc.warn('Write file failed: ' + e.message);
            return new Error(e.message);
        }
    },

    readFile (filePath, encoding, onComplete) {
        wxUtils.fs.readFile({
            filePath: filePath,
            encoding: encoding,
            success: function (res) {
                onComplete && onComplete(null, res.data);
            },
            fail: function (res) {
                cc.warn('Read file failed: ' + res.errMsg);
                onComplete && onComplete (new Error(res.errMsg), null);
            }
        });
    },

    readDir (filePath, onComplete) {
        wxUtils.fs.readdir({
            dirPath: filePath,
            success: function (res) {
                onComplete && onComplete(null, res.files);
            },
            fail: function (res) {
                cc.warn('Read directory failed: ' + res.errMsg);
                onComplete && onComplete(new Error(res.errMsg), null);
            }
        });
    },

    readText (filePath, onComplete) {
        wxUtils.readFile(filePath, 'utf8', onComplete);
    },

    readArrayBuffer (filePath, onComplete) {
        wxUtils.readFile(filePath, '', onComplete);
    },

    readJson (filePath, onComplete) {
        wxUtils.readFile(filePath, 'utf8', function (err, text) {
            var out = null;
            if (!err) {
                try {
                    out = JSON.parse(text);
                }
                catch (e) {
                    cc.warn('Read json failed: ' + e.message);
                    err = new Error(e.message);
                }
            }
            onComplete && onComplete(err, out);
        });
    },

    readJsonSync (path) {
        try {
            var str = wxUtils.fs.readFileSync(path, 'utf8');
            return JSON.parse(str);
        }
        catch (e) {
            cc.warn('Read json failed: ' + e.message);
            return new Error(e.message);
        }
    },

    makeDirSync (path, recursive) {
        try {
            wxUtils.fs.mkdirSync(path, recursive);
            return null;
        }
        catch (e) {
            cc.warn('Make directory failed: ' + e.message);
            return new Error(e.message);
        }
    },

    exists (filePath, onComplete) {
        wxUtils.fs.access({
            path: filePath,
            success: function () {
                onComplete && onComplete(true);
            },
            fail: function () {
                onComplete && onComplete(false);
            }
        });
    },

    loadSubpackage (name, onProgress, onComplete) {
        var task = wx.loadSubpackage({
            name: name,
            success: function () {
                onComplete && onComplete();
            },
            fail: function (res) {
                cc.warn('Load Subpackage failed: ' + res.errMsg);
                onComplete && onComplete(new Error(`Failed to load subpackage ${name}: ${res.errMsg}`));
            }
        });
        onProgress && task.onProgressUpdate(onProgress);
        return task;
    }
}

cc.assetManager.wxUtils = module.exports = wxUtils;