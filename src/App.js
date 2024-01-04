import exifr from "exifr";
import FileSaver from "file-saver";
import JSZip from "jszip";
import moment from "moment";
import { useCallback, useEffect, useRef, useState } from "react";

function App() {
    const fileId = useRef(0);
    const inputRef = useRef();
    const dragRef = useRef();
    const [isDragging, setIsDragging] = useState(false);
    const [files, setFiles] = useState([]);
    const [convertedFiles, setConvertedFiles] = useState({});
    const [isConverting, setConverting] = useState(false);
    const [convertCount, setConvertCount] = useState(0);
    const [isCompress, setCompress] = useState(true);
    const MAX_WIDTH = 1920;
    const MAX_HEIGHT = 1080;

    const onChangeFiles = useCallback(
        (e) => {
            let selectFiles = [];
            let tempFiles = files;

            if (e.type === "drop") {
                selectFiles = e.dataTransfer.files;
            } else {
                selectFiles = e.target.files;
            }

            for (const file of selectFiles) {
                tempFiles = [
                    ...tempFiles,
                    {
                        id: fileId.current++,
                        object: file,
                    },
                ];
            }

            setFiles(tempFiles);
        },
        [files]
    );

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        onChangeFiles(e);
    }, []);

    const addFiles = useCallback(async () => {
        const f = {};
        let currentConvertCount = 0;
        setConvertedFiles([]);
        setConverting(true);

        if (files.length === 0) setConverting(false);
        files.forEach(async (file, index) => {
            const uf = await processFile(file.object);
            const et = await exifr.parse(file.object);
            const momentDate = moment(et.ModifyDate);
            const d = {
                y: momentDate.format("YYYY"),
                m: momentDate.format("M"),
                d: momentDate.format("D"),
            };
            if (!f[d.y]) f[d.y] = {};
            if (!f[d.y][d.m]) f[d.y][d.m] = {};
            if (!f[d.y][d.m][d.d]) f[d.y][d.m][d.d] = [];
            f[d.y][d.m][d.d].push({
                name: file.object.name.split(".")[0] + ".webp",
                data: uf,
            });

            if (index === files.length - 1) {
                setConverting(false);
            }
        });
        setConvertedFiles(f);
        setConvertCount(files.length);
    });

    useEffect(() => {
        setConverting(true);
        setConvertCount(0);
        addFiles();
    }, [files]);

    const handleDragIn = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDragOut = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const initDragEvents = useCallback(() => {
        if (dragRef.current !== null) {
            dragRef.current.addEventListener("dragenter", handleDragIn);
            dragRef.current.addEventListener("dragleave", handleDragOut);
            dragRef.current.addEventListener("dragover", handleDragOver);
            dragRef.current.addEventListener("drop", handleDrop);
        }
    }, [handleDragIn, handleDragOut, handleDragOver, handleDrop]);

    const resetDragEvents = useCallback(() => {
        if (dragRef.current !== null) {
            dragRef.current.removeEventListener("dragenter", handleDragIn);
            dragRef.current.removeEventListener("dragleave", handleDragOut);
            dragRef.current.removeEventListener("dragover", handleDragOver);
            dragRef.current.removeEventListener("drop", handleDrop);
        }
    }, [handleDragIn, handleDragOut, handleDragOver, handleDrop]);

    useEffect(() => {
        initDragEvents();

        return () => resetDragEvents();
    }, [initDragEvents, resetDragEvents]);

    const handlePaste = async (e) => {
        // const clipboardItems = e.clipboardData.items;
        //TODO: Have to add copy & paste upload
    };

    async function processFile(file) {
        return new Promise(function (resolve, reject) {
            let rawImage = new Image();

            let canvas = document.createElement("canvas");
            let ctx = canvas.getContext("2d");

            rawImage.onload = function () {
                if (rawImage.src) {
                    var width = rawImage.width;
                    var height = rawImage.height;
                    if (isCompress) {
                        if (width > height) {
                            if (width > MAX_WIDTH) {
                                height *= MAX_WIDTH / width;
                                width = MAX_WIDTH;
                            }
                        } else {
                            if (height > MAX_HEIGHT) {
                                width *= MAX_HEIGHT / height;
                                height = MAX_HEIGHT;
                            }
                        }
                    }
                    canvas.width = width;
                    canvas.height = height;

                    ctx.drawImage(rawImage, 0, 0, width, height);
                    canvas.toBlob(function (blob) {
                        resolve(blob);
                    }, "image/webp");
                }
            };
            rawImage.src = URL.createObjectURL(file);
            rawImage.crossOrigin = "Anonymous";
        });
    }

    const getObjectDataOfDepth = (data, depth, currentDepth = 0) => {
        if (depth > currentDepth)
            return getObjectDataOfDepth(
                data[Object.keys(data)[0]],
                depth,
                currentDepth + 1
            );
        else return data;
    };

    const oneFileDownload = () => {
        const file = getObjectDataOfDepth(convertedFiles, 3)[0];
        const url = URL.createObjectURL(file.data);
        console.log(url);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        setTimeout((_) => {
            window.URL.revokeObjectURL(url);
        }, 60000);
        a.remove();
    };

    const multipleFileDownload = async () => {
        const zip = JSZip();
        await Object.entries(convertedFiles).forEach(([year, months]) => {
            const yf = zip.folder(year);
            Object.entries(months).forEach(([month, days]) => {
                const mf = yf.folder(month);
                Object.entries(days).forEach(([day, files]) => {
                    const df = mf.folder(day);
                    files.map(async (file) => {
                        await df.file(file.name, file.data);
                    });
                });
            });
        });
        zip.generateAsync({ type: "blob" }).then((content) => {
            FileSaver.saveAs(content, "test.zip");
        });
    };

    const handleDownload = async () => {
        convertCount === 1 ? oneFileDownload() : await multipleFileDownload();
    };

    return (
        <div
            className="w-full h-screen flex justify-center items-center flex-col bg-cyan-100"
            ref={dragRef}
            onPaste={handlePaste}
        >
            <div className="mb-4 w-full text-center">
                <p className="text-xl text-gray-500">
                    Would you like to automatically clean standard photos based
                    on date?
                </p>
                <p className="text-xl text-gray-500">
                    This program will help you achieve what you want without a
                    network.
                </p>
                <h2 className="text-4xl font-extrabold">
                    Upload JPG/JPEG File!
                </h2>
            </div>
            <div className="mb-4">
                <label className="mr-2">
                    Do you want compress image file ? (1920 x 1080)
                </label>
                <input
                    type="checkbox"
                    checked={isCompress}
                    onChange={(e) => setCompress(!isCompress)}
                />
            </div>
            <label
                htmlFor={"file-upload"}
                className="border rounded p-8 w-96 flex-col items-center text-center bg-white relative"
            >
                <button className="border rounded py-2 px-4 border-gray-300">
                    + File Upload
                </button>
                <input
                    type="file"
                    multiple
                    id="file-upload"
                    className="opacity-0 absolute inset-0"
                    ref={inputRef}
                    onChange={onChangeFiles}
                    onDrop={handleDrop}
                />
                <p className="my-4">OR</p>

                <p className="border-dashed border-4 py-12">Drag & Drop</p>
            </label>

            <button className="realtive mt-4">
                {convertedFiles && Object.keys(convertedFiles).length > 0 && (
                    <p className="underline" onClick={() => handleDownload()}>
                        Download
                    </p>
                )}
                {isConverting && (
                    <p onClick={() => handleDownload()}>Converting...</p>
                )}
            </button>
        </div>
    );
}

export default App;
