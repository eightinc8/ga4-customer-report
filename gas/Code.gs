/**
 * GA4 週次レポート自動取得 & VPS送信スクリプト
 *
 * 【設定手順】
 * 1. Google Apps Script で新規プロジェクトを作成
 * 2. このコードを貼り付け
 * 3. スクリプトプロパティに以下を設定:
 *    - VPS_API_URL: https://ga4kanri.customer8.jp/api/reports/push
 *    - VPS_API_KEY: VPS側の.envに設定したGAS_API_KEYと同じ値
 *    - SPREADSHEET_ID: 顧客管理スプレッドシートのID
 * 4. Google Analytics Data API を有効化（サービス追加）
 * 5. トリガーを設定（毎週月曜 9:00-10:00 に実行）
 */

// ===== メイン処理 =====

/**
 * 週次レポートを全顧客分取得してVPSに送信
 * トリガーからこの関数を呼び出す
 */
function weeklyReport() {
  const customers = getCustomersFromSheet();

  customers.forEach(function (customer) {
    if (customer.status !== '有効') return;

    try {
      const report = fetchGA4Data(customer.propertyId, customer);
      pushToVPS(customer.propertyId, report);
      logResult(customer.companyName, '成功', '');
    } catch (e) {
      logResult(customer.companyName, '失敗', e.message);
      Logger.log('Error for ' + customer.companyName + ': ' + e.message);
    }
  });
}

// ===== スプレッドシート連携 =====

/**
 * スプレッドシートから顧客一覧を取得
 * シート「顧客一覧」のフォーマット:
 * A列: 会社名 | B列: ログインID | C列: GA4プロパティID | D列: ステータス
 */
function getCustomersFromSheet() {
  var props = PropertiesService.getScriptProperties();
  var ssId = props.getProperty('SPREADSHEET_ID');
  var ss = SpreadsheetApp.openById(ssId);
  var sheet = ss.getSheetByName('顧客一覧');

  if (!sheet) {
    throw new Error('「顧客一覧」シートが見つかりません');
  }

  var data = sheet.getDataRange().getValues();
  var customers = [];

  // 1行目はヘッダー、2行目からデータ
  // A:会社名 B:ログインID C:GA4プロパティID D:ステータス E:サイトURL(Search Console用)
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] && data[i][2]) {
      customers.push({
        companyName: data[i][0],
        loginId: data[i][1],
        propertyId: String(data[i][2]),
        status: data[i][3] || '有効',
        siteUrl: data[i][4] || ''
      });
    }
  }

  return customers;
}

/**
 * 顧客一覧をVPSのDBに同期
 * 手動実行用: スプレッドシートの内容をVPSに反映
 */
function syncCustomersToVPS() {
  var customers = getCustomersFromSheet();
  Logger.log('同期対象: ' + customers.length + '件');
  customers.forEach(function (c) {
    Logger.log('  - ' + c.companyName + ' (Property: ' + c.propertyId + ')');
  });
}

// ===== GA4 Data API =====

/**
 * GA4からデータを取得（今週 + 先週）
 */
function fetchGA4Data(propertyId, customer) {
  var today = new Date();
  var dayOfWeek = today.getDay();

  // 今週の月曜日を基準にする
  var thisMonday = new Date(today);
  thisMonday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

  // 先週の範囲
  var lastMonday = new Date(thisMonday);
  lastMonday.setDate(thisMonday.getDate() - 7);
  var lastSunday = new Date(thisMonday);
  lastSunday.setDate(thisMonday.getDate() - 1);

  // 先々週の範囲
  var prevMonday = new Date(lastMonday);
  prevMonday.setDate(lastMonday.getDate() - 7);
  var prevSunday = new Date(lastMonday);
  prevSunday.setDate(lastMonday.getDate() - 1);

  // 今週分（先週の月〜日）
  var currentData = runGA4Report(propertyId, formatDate(lastMonday), formatDate(lastSunday));
  // 先々週分
  var previousData = runGA4Report(propertyId, formatDate(prevMonday), formatDate(prevSunday));

  // 流入元別セッション
  var trafficSources = getTrafficSources(propertyId, formatDate(lastMonday), formatDate(lastSunday));
  var prevTrafficSources = getTrafficSources(propertyId, formatDate(prevMonday), formatDate(prevSunday));

  // 人気ページTOP20（前週PV・URL付き）+ PV推移（過去8週）
  var topPages = getTopPages(propertyId, formatDate(lastMonday), formatDate(lastSunday),
                             formatDate(prevMonday), formatDate(prevSunday), customer.siteUrl || '');
  var trendStart = new Date(lastMonday);
  trendStart.setDate(lastMonday.getDate() - 49); // 8週前の月曜
  var weekKeys = [];
  for (var w = 0; w < 8; w++) {
    var wk = new Date(trendStart);
    wk.setDate(trendStart.getDate() + w * 7);
    weekKeys.push(formatDate(wk));
  }
  var trendMap = getPageTrends(propertyId, topPages.map(function(p) { return p.path; }),
                               formatDate(trendStart), formatDate(lastSunday));
  topPages.forEach(function(p) {
    var m = trendMap[p.path] || {};
    p.trend = weekKeys.map(function(k) { return m[k] || 0; });
  });

  // 登録ページの詳細計測
  var trackedPages = [];
  var trackedList = getTrackedPathsFromVPS(propertyId);
  if (trackedList.length > 0) {
    var trackedPaths = trackedList.map(function(t) { return t.path; });
    var curMetrics = getTrackedPageMetrics(propertyId, trackedPaths, formatDate(lastMonday), formatDate(lastSunday));
    var prevMetrics = getTrackedPageMetrics(propertyId, trackedPaths, formatDate(prevMonday), formatDate(prevSunday));
    var trackedTrend = getPageTrends(propertyId, trackedPaths, formatDate(trendStart), formatDate(lastSunday));

    trackedPages = trackedList.map(function(t) {
      var cur = curMetrics[t.path] || { views: 0, bounceRate: 0, avgEngagementTime: 0, scrollRate: 0 };
      var prev = prevMetrics[t.path] || { views: 0, bounceRate: 0, avgEngagementTime: 0, scrollRate: 0 };
      var tm = trackedTrend[t.path] || {};
      return {
        path: t.path,
        label: t.label || '',
        url: buildPageUrl(customer.siteUrl || '', t.path),
        views: cur.views,
        prevViews: prev.views,
        bounceRate: cur.bounceRate,
        prevBounceRate: prev.bounceRate,
        avgEngagementTime: cur.avgEngagementTime,
        prevAvgEngagementTime: prev.avgEngagementTime,
        scrollRate: cur.scrollRate,
        prevScrollRate: prev.scrollRate,
        trend: weekKeys.map(function(k) { return tm[k] || 0; })
      };
    });
  }

  return {
    weekStart: formatDate(lastMonday),
    weekEnd: formatDate(lastSunday),
    sessions: currentData.sessions,
    pageviews: currentData.pageviews,
    usersCount: currentData.usersCount,
    bounceRate: currentData.bounceRate,
    avgSessionDuration: currentData.avgSessionDuration,
    newUsers: currentData.newUsers,
    returningUsers: currentData.returningUsers,
    prevSessions: previousData.sessions,
    prevPageviews: previousData.pageviews,
    prevUsersCount: previousData.usersCount,
    prevBounceRate: previousData.bounceRate,
    prevAvgSessionDuration: previousData.avgSessionDuration,
    prevNewUsers: previousData.newUsers,
    prevReturningUsers: previousData.returningUsers,
    topPages: topPages,
    topKeywords: getTopKeywords(customer.siteUrl || '', formatDate(lastMonday), formatDate(lastSunday)),
    trafficSources: trafficSources,
    prevTrafficSources: prevTrafficSources,
    trackedPages: trackedPages
  };
}

/**
 * GA4 Data API でレポートを取得
 */
function runGA4Report(propertyId, startDate, endDate) {
  var request = AnalyticsData.Properties.runReport({
    dateRanges: [{ startDate: startDate, endDate: endDate }],
    metrics: [
      { name: 'sessions' },
      { name: 'screenPageViews' },
      { name: 'totalUsers' },
      { name: 'bounceRate' },
      { name: 'averageSessionDuration' },
      { name: 'newUsers' },
      { name: 'activeUsers' }
    ]
  }, 'properties/' + propertyId);

  if (!request.rows || request.rows.length === 0) {
    return {
      sessions: 0,
      pageviews: 0,
      usersCount: 0,
      bounceRate: 0,
      avgSessionDuration: 0,
      newUsers: 0,
      returningUsers: 0
    };
  }

  var values = request.rows[0].metricValues;
  var newUsers = parseInt(values[5].value) || 0;
  var activeUsers = parseInt(values[6].value) || 0;
  return {
    sessions: parseInt(values[0].value) || 0,
    pageviews: parseInt(values[1].value) || 0,
    usersCount: parseInt(values[2].value) || 0,
    bounceRate: (parseFloat(values[3].value) || 0) * 100, // GA4は0〜1の割合で返すため%に変換
    avgSessionDuration: parseFloat(values[4].value) || 0,
    newUsers: newUsers,
    returningUsers: Math.max(0, activeUsers - newUsers)
  };
}

// ===== VPS送信 =====

/**
 * レポートデータをVPSのAPIに送信
 */
function pushToVPS(propertyId, report) {
  var props = PropertiesService.getScriptProperties();
  var apiUrl = props.getProperty('VPS_API_URL');
  var apiKey = props.getProperty('VPS_API_KEY');

  var payload = {
    propertyId: propertyId,
    weekStart: report.weekStart,
    weekEnd: report.weekEnd,
    sessions: report.sessions,
    pageviews: report.pageviews,
    usersCount: report.usersCount,
    bounceRate: report.bounceRate,
    avgSessionDuration: report.avgSessionDuration,
    prevSessions: report.prevSessions,
    prevPageviews: report.prevPageviews,
    prevUsersCount: report.prevUsersCount,
    prevBounceRate: report.prevBounceRate,
    prevAvgSessionDuration: report.prevAvgSessionDuration,
    newUsers: report.newUsers,
    returningUsers: report.returningUsers,
    prevNewUsers: report.prevNewUsers,
    prevReturningUsers: report.prevReturningUsers,
    topPages: report.topPages,
    topKeywords: report.topKeywords,
    trafficSources: report.trafficSources,
    prevTrafficSources: report.prevTrafficSources,
    trackedPages: report.trackedPages
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'X-API-Key': apiKey
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(apiUrl, options);
  var code = response.getResponseCode();

  if (code !== 200) {
    throw new Error('VPS API error: ' + code + ' - ' + response.getContentText());
  }
}

// ===== 人気ページ取得 =====

/**
 * GA4から人気ページTOP20を取得（前週PV・記事URLも付与）
 */
function getTopPages(propertyId, startDate, endDate, prevStartDate, prevEndDate, siteUrl) {
  try {
    var request = AnalyticsData.Properties.runReport({
      dateRanges: [{ startDate: startDate, endDate: endDate }],
      dimensions: [
        { name: 'pageTitle' },
        { name: 'pagePath' }
      ],
      metrics: [
        { name: 'screenPageViews' }
      ],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit: 20
    }, 'properties/' + propertyId);

    if (!request.rows || request.rows.length === 0) return [];

    var pages = request.rows.map(function(row) {
      var path = row.dimensionValues[1].value;
      return {
        title: row.dimensionValues[0].value,
        path: path,
        url: buildPageUrl(siteUrl, path),
        views: parseInt(row.metricValues[0].value) || 0,
        prevViews: 0,
        trend: []
      };
    });

    // 前週の同ページPVを取得してマッチング
    if (prevStartDate && prevEndDate) {
      try {
        var paths = pages.map(function(p) { return p.path; });
        var prevReport = AnalyticsData.Properties.runReport({
          dateRanges: [{ startDate: prevStartDate, endDate: prevEndDate }],
          dimensions: [{ name: 'pagePath' }],
          metrics: [{ name: 'screenPageViews' }],
          dimensionFilter: {
            filter: {
              fieldName: 'pagePath',
              inListFilter: { values: paths }
            }
          },
          limit: 100
        }, 'properties/' + propertyId);

        var prevMap = {};
        if (prevReport.rows) {
          prevReport.rows.forEach(function(row) {
            prevMap[row.dimensionValues[0].value] = parseInt(row.metricValues[0].value) || 0;
          });
        }
        pages.forEach(function(p) {
          p.prevViews = prevMap[p.path] || 0;
        });
      } catch (e) {
        Logger.log('getTopPages prev error: ' + e.message);
      }
    }

    return pages;
  } catch (e) {
    Logger.log('getTopPages error: ' + e.message);
    return [];
  }
}

/**
 * サイトURLとページパスから記事の完全URLを生成
 */
function buildPageUrl(siteUrl, path) {
  if (!siteUrl) return '';
  var base = String(siteUrl).replace(/\/+$/, '');
  if (!path) return base;
  var p = String(path);
  if (p.charAt(0) !== '/') p = '/' + p;
  return base + p;
}

/**
 * 指定パス群の週次PV推移を取得（過去8週分）
 * 返り値: { '/path': { 'YYYY-MM-DD(週の月曜)': PV, ... }, ... }
 */
function getPageTrends(propertyId, paths, startDate, endDate) {
  if (!paths || paths.length === 0) return {};
  try {
    var report = AnalyticsData.Properties.runReport({
      dateRanges: [{ startDate: startDate, endDate: endDate }],
      dimensions: [{ name: 'pagePath' }, { name: 'date' }],
      metrics: [{ name: 'screenPageViews' }],
      dimensionFilter: {
        filter: { fieldName: 'pagePath', inListFilter: { values: paths } }
      },
      limit: 10000
    }, 'properties/' + propertyId);

    var map = {};
    if (report.rows) {
      report.rows.forEach(function(row) {
        var path = row.dimensionValues[0].value;
        var dateStr = row.dimensionValues[1].value; // YYYYMMDD
        var v = parseInt(row.metricValues[0].value) || 0;
        var weekKey = mondayOfDateStr(dateStr);
        if (!map[path]) map[path] = {};
        map[path][weekKey] = (map[path][weekKey] || 0) + v;
      });
    }
    return map;
  } catch (e) {
    Logger.log('getPageTrends error: ' + e.message);
    return {};
  }
}

/**
 * YYYYMMDD文字列 → その週の月曜日(YYYY-MM-DD)
 */
function mondayOfDateStr(yyyymmdd) {
  var y = parseInt(yyyymmdd.substring(0, 4), 10);
  var m = parseInt(yyyymmdd.substring(4, 6), 10) - 1;
  var d = parseInt(yyyymmdd.substring(6, 8), 10);
  var dt = new Date(y, m, d);
  var dow = dt.getDay();
  dt.setDate(dt.getDate() - (dow === 0 ? 6 : dow - 1));
  return formatDate(dt);
}

// ===== 登録ページ計測 =====

/**
 * VPSから登録ページ一覧を取得
 * 返り値: [{ path, label }, ...]
 */
function getTrackedPathsFromVPS(propertyId) {
  try {
    var props = PropertiesService.getScriptProperties();
    var apiUrl = props.getProperty('VPS_API_URL'); // .../api/reports/push
    var apiKey = props.getProperty('VPS_API_KEY');
    // push用URLからベースを組み立て
    var base = apiUrl.replace(/\/api\/reports\/push\/?$/, '');
    var url = base + '/api/tracked-pages/gas?propertyId=' + encodeURIComponent(propertyId);

    var response = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: { 'X-API-Key': apiKey },
      muteHttpExceptions: true
    });

    if (response.getResponseCode() !== 200) return [];
    var json = JSON.parse(response.getContentText());
    return json.pages || [];
  } catch (e) {
    Logger.log('getTrackedPathsFromVPS error: ' + e.message);
    return [];
  }
}

/**
 * 指定パス群の詳細指標を取得
 * 返り値: { '/path': { views, bounceRate(%), avgEngagementTime(秒), scrollRate(%) }, ... }
 */
function getTrackedPageMetrics(propertyId, paths, startDate, endDate) {
  var result = {};
  if (!paths || paths.length === 0) return result;

  try {
    // 主要指標
    var report = AnalyticsData.Properties.runReport({
      dateRanges: [{ startDate: startDate, endDate: endDate }],
      dimensions: [{ name: 'pagePath' }],
      metrics: [
        { name: 'screenPageViews' },
        { name: 'bounceRate' },
        { name: 'userEngagementDuration' },
        { name: 'activeUsers' }
      ],
      dimensionFilter: {
        filter: { fieldName: 'pagePath', inListFilter: { values: paths } }
      },
      limit: 100
    }, 'properties/' + propertyId);

    if (report.rows) {
      report.rows.forEach(function(row) {
        var path = row.dimensionValues[0].value;
        var v = row.metricValues;
        var views = parseInt(v[0].value) || 0;
        var bounce = (parseFloat(v[1].value) || 0) * 100;
        var engDur = parseFloat(v[2].value) || 0;
        var activeUsers = parseInt(v[3].value) || 0;
        result[path] = {
          views: views,
          bounceRate: bounce,
          avgEngagementTime: activeUsers > 0 ? engDur / activeUsers : 0,
          scrollRate: 0
        };
      });
    }

    // スクロール率（scrollイベント数 ÷ PV）
    try {
      var scrollReport = AnalyticsData.Properties.runReport({
        dateRanges: [{ startDate: startDate, endDate: endDate }],
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'eventCount' }],
        dimensionFilter: {
          andGroup: {
            expressions: [
              { filter: { fieldName: 'pagePath', inListFilter: { values: paths } } },
              { filter: { fieldName: 'eventName', stringFilter: { matchType: 'EXACT', value: 'scroll' } } }
            ]
          }
        },
        limit: 100
      }, 'properties/' + propertyId);

      if (scrollReport.rows) {
        scrollReport.rows.forEach(function(row) {
          var path = row.dimensionValues[0].value;
          var scrolls = parseInt(row.metricValues[0].value) || 0;
          if (result[path] && result[path].views > 0) {
            result[path].scrollRate = Math.min(100, (scrolls / result[path].views) * 100);
          }
        });
      }
    } catch (e2) {
      Logger.log('scroll metric error: ' + e2.message);
    }

    return result;
  } catch (e) {
    Logger.log('getTrackedPageMetrics error: ' + e.message);
    return result;
  }
}

// ===== 人気キーワード取得（Search Console） =====

/**
 * Google Search Consoleから人気キーワードTOP10を取得
 * サイトURLが設定されていない場合はスキップ
 * ※ Search Console APIサービスの追加が必要
 */
function getTopKeywords(siteUrl, startDate, endDate) {
  if (!siteUrl) return [];

  try {
    var response = SearchConsole.Searchanalytics.query({
      startDate: startDate,
      endDate: endDate,
      dimensions: ['query'],
      rowLimit: 10,
      type: 'web'
    }, siteUrl);

    if (!response.rows || response.rows.length === 0) return [];

    return response.rows.map(function(row) {
      return {
        keyword: row.keys[0],
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: Math.round(row.ctr * 1000) / 10,
        position: Math.round(row.position * 10) / 10
      };
    });
  } catch (e) {
    Logger.log('getTopKeywords error: ' + e.message);
    return [];
  }
}

// ===== 流入元別セッション取得 =====

/**
 * GA4からチャネル別セッション数を取得
 * 直接流入・自然検索・AI検索・SNS流入・その他 に分類
 */
function getTrafficSources(propertyId, startDate, endDate) {
  try {
    // チャネルグループ別セッション
    var channelReport = AnalyticsData.Properties.runReport({
      dateRanges: [{ startDate: startDate, endDate: endDate }],
      dimensions: [{ name: 'sessionDefaultChannelGroup' }],
      metrics: [{ name: 'sessions' }]
    }, 'properties/' + propertyId);

    var channels = { direct: 0, organic_search: 0, social: 0, other: 0 };
    if (channelReport.rows) {
      channelReport.rows.forEach(function(row) {
        var group = row.dimensionValues[0].value.toLowerCase();
        var sessions = parseInt(row.metricValues[0].value) || 0;
        if (group === 'direct') {
          channels.direct += sessions;
        } else if (group === 'organic search') {
          channels.organic_search += sessions;
        } else if (group === 'organic social' || group === 'paid social') {
          channels.social += sessions;
        } else {
          channels.other += sessions;
        }
      });
    }

    // AI検索ソースの識別
    var aiSources = ['chatgpt.com', 'perplexity', 'you.com', 'claude.ai', 'copilot',
                     'gemini.google', 'bard', 'phind', 'poe.com', 'ai-overview'];
    var aiReport = AnalyticsData.Properties.runReport({
      dateRanges: [{ startDate: startDate, endDate: endDate }],
      dimensions: [{ name: 'sessionSource' }],
      metrics: [{ name: 'sessions' }]
    }, 'properties/' + propertyId);

    var aiSessions = 0;
    if (aiReport.rows) {
      aiReport.rows.forEach(function(row) {
        var source = (row.dimensionValues[0].value || '').toLowerCase();
        for (var i = 0; i < aiSources.length; i++) {
          if (source.indexOf(aiSources[i]) !== -1) {
            aiSessions += parseInt(row.metricValues[0].value) || 0;
            break;
          }
        }
      });
    }

    // AI検索分を自然検索から差し引く
    channels.organic_search = Math.max(0, channels.organic_search - aiSessions);

    return {
      direct: channels.direct,
      organic_search: channels.organic_search,
      ai_search: aiSessions,
      social: channels.social,
      other: channels.other
    };
  } catch (e) {
    Logger.log('getTrafficSources error: ' + e.message);
    return { direct: 0, organic_search: 0, ai_search: 0, social: 0, other: 0 };
  }
}

// ===== ユーティリティ =====

function formatDate(date) {
  var y = date.getFullYear();
  var m = ('0' + (date.getMonth() + 1)).slice(-2);
  var d = ('0' + date.getDate()).slice(-2);
  return y + '-' + m + '-' + d;
}

/**
 * 実行結果をログシートに記録
 */
function logResult(companyName, status, errorMessage) {
  var props = PropertiesService.getScriptProperties();
  var ssId = props.getProperty('SPREADSHEET_ID');
  var ss = SpreadsheetApp.openById(ssId);
  var logSheet = ss.getSheetByName('実行ログ');

  if (!logSheet) {
    logSheet = ss.insertSheet('実行ログ');
    logSheet.appendRow(['実行日時', '会社名', '結果', 'エラー内容']);
  }

  logSheet.appendRow([new Date(), companyName, status, errorMessage]);
}

/**
 * テスト用: 1社だけ手動実行
 */
function testSingleCustomer() {
  var customers = getCustomersFromSheet();
  if (customers.length === 0) {
    Logger.log('顧客データがありません');
    return;
  }

  var customer = customers[0];
  Logger.log('テスト対象: ' + customer.companyName);

  var report = fetchGA4Data(customer.propertyId, customer);
  Logger.log('取得データ: ' + JSON.stringify(report));

  pushToVPS(customer.propertyId, report);
  Logger.log('VPS送信完了');
}

// ===== Webアプリ（スプレッドシート自動追加） =====

/**
 * VPSからの顧客追加リクエストを受け取り、スプレッドシートに追加
 * デプロイ → ウェブアプリとしてデプロイ で有効化
 */
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    if (data.action === 'addCustomer') {
      var props = PropertiesService.getScriptProperties();
      var ssId = props.getProperty('SPREADSHEET_ID');
      var ss = SpreadsheetApp.openById(ssId);
      var sheet = ss.getSheetByName('顧客一覧');

      if (!sheet) {
        return ContentService.createTextOutput(JSON.stringify({ error: 'シートが見つかりません' }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      // 重複チェック（GA4プロパティIDで）
      var existingData = sheet.getDataRange().getValues();
      for (var i = 1; i < existingData.length; i++) {
        if (String(existingData[i][2]) === String(data.ga4PropertyId)) {
          return ContentService.createTextOutput(JSON.stringify({ success: true, message: '既に存在します' }))
            .setMimeType(ContentService.MimeType.JSON);
        }
      }

      sheet.appendRow([data.companyName, data.loginId, data.ga4PropertyId, '有効']);

      return ContentService.createTextOutput(JSON.stringify({ success: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ error: '不明なアクション' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
