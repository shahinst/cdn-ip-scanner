// Loads the scanner library (src/scanner/*) into one object; tests pass fakes instead.
export async function loadScannerLib() {
  const [colo, core, v2ray, speedtest, clientExport, rangeFetcher, operators, xray] = await Promise.all([
    import('./scanner/colo.js'), import('./scanner/core.js'), import('./scanner/v2ray.js'),
    import('./scanner/speedtest.js'), import('./scanner/clientExport.js'),
    import('./scanner/rangeFetcher.js'), import('./scanner/operators.js'), import('./scanner/xray.js'),
  ]);
  return {
    COLO_NAMES: colo.COLO_NAMES, coloName: colo.coloName, coloLabel: colo.coloLabel,
    SPEED_MODES: core.SPEED_MODES, NetUtils: core.NetUtils, Scanner: core.Scanner,
    parseConfig: v2ray.parseConfig, rebuildConfig: v2ray.rebuildConfig,
    testIpWithConfig: v2ray.testIpWithConfig, buildSubscription: v2ray.buildSubscription,
    measureDownload: speedtest.measureDownload, DEFAULT_SPEED_TEST_URL: speedtest.DEFAULT_SPEED_TEST_URL,
    toClash: clientExport.toClash, toSingbox: clientExport.toSingbox,
    fetchRanges: rangeFetcher.fetchRanges,
    OPERATORS: operators.OPERATORS, fetchOperatorRanges: operators.fetchOperatorRanges,
    XRAY_VERSION: xray.XRAY_VERSION, xrayStatus: xray.xrayStatus, installXray: xray.installXray,
    testThroughXray: xray.testThroughXray,
  };
}
