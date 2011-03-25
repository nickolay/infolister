function onLoad() {
  sizeToContent();
  if(window.arguments.length > 0) {
    window.onCancel = window.arguments[1];
    setTimeout(window.arguments[0], 0, setProgress);
  }
}

function setProgress(val) {
  document.getElementById("progressMeter").value = val;
}
