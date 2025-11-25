import * as tus from "tus-js-client";
import Swal from "sweetalert2";

const uploader = {
  captureID: null,
  files: [],
  modal: null,

  init: function (inputSelector, captureID) {
    this.captureID = captureID;
    this.files = [];
    this.setupTrigger();
  },

  setupTrigger: function () {
    const trigger = document.getElementById("uppy-trigger");
    if (trigger) {
      trigger.addEventListener("click", () => this.openModal());
    }
  },

  openModal: function () {
    Swal.fire({
      title: "Upload Files",
      html: `
        <div id="upload-container" style="text-align: left;">
          <div id="drop-zone" style="border: 2px dashed #ccc; border-radius: 8px; padding: 40px; text-align: center; margin-bottom: 15px; cursor: pointer; transition: border-color 0.3s;">
            <p style="margin: 0; font-size: 16px;">Drag & drop files here or click to select</p>
            <p style="margin: 5px 0 0 0; font-size: 12px; color: #666;">Images, videos, .lif, .lifext files</p>
            <input type="file" id="file-input" multiple accept="image/*,video/*,.lif,.lifext" style="display: none;">
          </div>
          <div id="file-list" style="max-height: 200px; overflow-y: auto;"></div>
          <div id="overall-progress" style="display: none; margin-top: 15px;">
            <div style="background: #eee; border-radius: 4px; overflow: hidden;">
              <div id="progress-bar" style="height: 20px; background: #48c774; width: 0%; transition: width 0.3s;"></div>
            </div>
            <p id="progress-text" style="text-align: center; margin: 5px 0 0 0; font-size: 14px;">0%</p>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "Upload",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#48c774",
      didOpen: () => {
        this.files = [];
        this.setupDropZone();
      },
      preConfirm: () => {
        if (this.files.length === 0) {
          Swal.showValidationMessage("Please select at least one file");
          return false;
        }
        return this.uploadFiles();
      },
      allowOutsideClick: () => !Swal.isLoading(),
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        const { successful, failed } = result.value;
        if (failed.length > 0) {
          Swal.fire({
            icon: "warning",
            title: "Upload Complete",
            text: `${successful.length} succeeded, ${failed.length} failed`,
            didClose: () => location.reload(),
          });
        } else {
          Swal.fire({
            icon: "success",
            title: "Upload Complete",
            text: `${successful.length} file(s) uploaded successfully`,
            didClose: () => location.reload(),
          });
        }
      }
    });
  },

  setupDropZone: function () {
    const dropZone = document.getElementById("drop-zone");
    const fileInput = document.getElementById("file-input");

    dropZone.addEventListener("click", () => fileInput.click());

    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropZone.style.borderColor = "#48c774";
    });

    dropZone.addEventListener("dragleave", () => {
      dropZone.style.borderColor = "#ccc";
    });

    dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropZone.style.borderColor = "#ccc";
      this.addFiles(e.dataTransfer.files);
    });

    fileInput.addEventListener("change", (e) => {
      this.addFiles(e.target.files);
    });
  },

  addFiles: function (fileList) {
    for (const file of fileList) {
      if (
        !this.files.find((f) => f.name === file.name && f.size === file.size)
      ) {
        this.files.push(file);
      }
    }
    this.renderFileList();
  },

  removeFile: function (index) {
    this.files.splice(index, 1);
    this.renderFileList();
  },

  renderFileList: function () {
    const container = document.getElementById("file-list");
    if (this.files.length === 0) {
      container.innerHTML = "";
      return;
    }

    container.innerHTML = this.files
      .map(
        (file, index) => `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid #eee;">
        <span style="font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 250px;">${file.name}</span>
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 12px; color: #666;">${this.formatSize(file.size)}</span>
          <button type="button" onclick="window.uploader.removeFile(${index})" style="background: #ff3860; color: white; border: none; border-radius: 4px; padding: 2px 8px; cursor: pointer;">×</button>
        </div>
      </div>
    `,
      )
      .join("");
  },

  formatSize: function (bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    if (bytes < 1024 * 1024 * 1024)
      return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + " GB";
  },

  uploadFiles: async function () {
    const progressContainer = document.getElementById("overall-progress");
    const progressBar = document.getElementById("progress-bar");
    const progressText = document.getElementById("progress-text");

    progressContainer.style.display = "block";

    const results = { successful: [], failed: [] };
    const totalFiles = this.files.length;
    let completedFiles = 0;

    Swal.showLoading();

    for (const file of this.files) {
      try {
        await this.uploadSingleFile(file, (progress) => {
          const fileProgress = progress / totalFiles;
          const overallProgress =
            (completedFiles / totalFiles) * 100 + fileProgress;
          progressBar.style.width = overallProgress + "%";
          progressText.textContent = Math.round(overallProgress) + "%";
        });
        results.successful.push(file.name);
      } catch (error) {
        console.error("Upload failed for", file.name, error);
        results.failed.push(file.name);
      }
      completedFiles++;
    }

    progressBar.style.width = "100%";
    progressText.textContent = "100%";

    return results;
  },

  uploadSingleFile: function (file, onProgress) {
    return new Promise((resolve, reject) => {
      const metadata = {
        filename: file.name,
        filetype: file.type || "application/octet-stream",
        captureID: this.captureID,
      };

      const upload = new tus.Upload(file, {
        endpoint: "/uploads/",
        retryDelays: [0, 1000, 3000, 5000],
        metadata: metadata,
        onError: (error) => {
          console.error("Upload error:", error);
          reject(error);
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          const percentage = (bytesUploaded / bytesTotal) * 100;
          onProgress(percentage);
        },
        onSuccess: () => {
          console.log("Upload complete for", file.name);
          resolve();
        },
      });

      upload.start();
    });
  },
};

window.uploader = uploader;
