function clearExplain() {
    document.getElementById("content").innerHTML = '';
    document.getElementById("tree").innerHTML = '<pre id="treepre"></pre>';
    document.getElementById("explaintext").value = '';
}

function lineToArray(line, columnstarts) {
    cols = [];
    for (let i = 0; i < columnstarts.length - 1; i++) {
        colStart = columnstarts[i] + 2
        colEnd = columnstarts[i + 1] - 1;
        cols.push(line.substring(colStart, colEnd));
    }
    return cols;
}

function lineToObj(line, explaininfo) {
    colData = {}
    cols = lineToArray(line, explaininfo["columnstarts"]);
    for (let i = 0; i < cols.length; i++) {
        colData[explaininfo["columnnames"][i]] = cols[i];
    }
    return colData;
}

function formatInfo(info) {
    return info.replace(/: ?\{/g, ":{\n")
        .replace(/, /g, ",\n")
        .trim();
}

function explainExplain(explaininfo) {
    outputDiv = document.getElementById("content");
    treeDiv = document.getElementById("tree")
    treeDiv.innerHTML = '<pre id="treepre"></pre>';
    treePre = document.getElementById("treepre");
    outputDiv.innerHTML = '';
    treeDiv.insertBefore(document.createTextNode("Explain Tree"), treePre);
    explaininfo["rows"].forEach((row) => {
        treePre.appendChild(document.createTextNode(row["id"] + "\n"));
        outputDiv.appendChild(document.createElement("hr"));
        outputDiv.appendChild(document.createTextNode("Going to try and explain this row:"));
        t = document.createElement("table");
        t.className = "explainrow";
        rt = document.createElement("tr");
        rd = document.createElement("tr");
        for ([col, val] of Object.entries(row)) {
            c = document.createElement("td");
            c.appendChild(document.createTextNode(col));
            rt.appendChild(c)

            c = document.createElement("td");
            pre = document.createElement("pre");
            pre.appendChild(document.createTextNode(formatInfo(val)));
            c.appendChild(pre);
            rd.appendChild(c)
        }
        t.appendChild(rt)
        t.appendChild(rd)
        outputDiv.appendChild(t)

        if (row["task"].trim() == "cop[tikv]") {
            outputDiv.appendChild(document.createTextNode("Using coprocessor for TiKV row based storage."));
            outputDiv.appendChild(document.createElement("br"));
            link = document.createElement("a");
            link.appendChild(document.createTextNode("For more info: TiDB Docs: TiKV Coprocessor"));
            link.href = "https://docs.pingcap.com/tidb/stable/tikv-overview#tikv-coprocessor";
            outputDiv.appendChild(link);
            outputDiv.appendChild(document.createElement("br"));
        }

        if (row["task"].trim() == "cop[tiflash]") {
            outputDiv.appendChild(document.createTextNode("Using coprocessor for TiFlash column based storage."));
            outputDiv.appendChild(document.createElement("br"));
            link = document.createElement("a");
            link.appendChild(document.createTextNode("For more info: TiFlash Overview"));
            link.href = "https://docs.pingcap.com/tidb/stable/tiflash-overview";
            outputDiv.appendChild(link);
            outputDiv.appendChild(document.createElement("br"));
        }

        if (row["operator info"].match(/stats:pseudo/)) {
            outputDiv.appendChild(document.createTextNode("Using pseudo statistics, consider running ANALYZE TABLE."));
            outputDiv.appendChild(document.createElement("br"));
        }

        // https://docs.pingcap.com/tidb/dev/explain-overview#operator-overview
        // https://docs.pingcap.com/tidb/dev/choose-index#operators-for-accessing-tables
        operator = row["id"].match(/([A-Z].*)_/)[1]
        let operatorAdv = undefined;
        let operatorURL = undefined;
        switch (operator) {
            case "TableDual":
                operatorAdv = "Virtual single row table.";
                break;
            case "TableFullScan":
                operatorAdv = "Full table scan, consider adding an index.";
                break;
            case "TableRangeScan":
                operatorAdv = "Scans a range of the table.";
                break;
            case "TableReader":
                operatorAdv = "Aggregates the data obtained by the underlying operators like TableFullScan or TableRangeScan in TiKV.";
                break;
            case "TableRowIDScan":
                operatorAdv = "Scans the table data based on the RowID. Usually follows an index read operation to retrieve the matching data rows.";
                break;
            case "IndexFullScan":
                operatorAdv = "Scans the full index, rather than the table data.";
                break;
            case "IndexRangeScan":
                operatorAdv = "Scans a range of the index.";
                break;
            case "HashJoin":
                operatorURL = "https://docs.pingcap.com/tidb/dev/explain-joins#hash-join";
                break;
            case "ExchangeSender":
                operatorURL = "https://docs.pingcap.com/tidb/dev/explain-mpp#exchange-operators";
                break;
            case "HashAgg":
                operatorURL = "https://docs.pingcap.com/tidb/dev/explain-aggregation#hash-aggregation";
                break;
            case "Projection":
                operatorAdv = "Maps expression value(s) to select list.";
                break;
            case "StreamAgg":
                operatorURL = "https://docs.pingcap.com/tidb/dev/explain-aggregation#stream-aggregation";
                break;
            default:
                console.log("No advise available for '" + operator + "' operator");
        }

        if (operatorAdv) {
            outputDiv.appendChild(document.createTextNode("Info for the \"" + operator + "\" operator: " + operatorAdv));
            outputDiv.appendChild(document.createElement("br"));
        }

        if (operatorURL) {
            link = document.createElement("a");
            link.appendChild(document.createTextNode("More info on the " + operator + " operator can be found here."));
            link.href = operatorURL;
            outputDiv.appendChild(link);
        }


    });
}

function checkExplain() {
    explaininfo = {
        "columnstarts": [],
        "columnnames": [],
        "rows": [],
    };
    hasColumnInfo = false;
    hasColumnNames = false;
    rowNumber = 0;
    expText = document.getElementById("explaintext").value;
    expLines = expText.split(/\r?\n/);

    expLines.forEach((expLine) => {
        if ((expLine[0] == "+") && !hasColumnInfo) {
            hasColumnInfo = true;
            for (let i = 0; i < expLine.length; i++) {
                if (expLine[i] == "+") {
                    explaininfo["columnstarts"].push(i)
                }
            }
        } else if ((expLine[0] == "|") && hasColumnInfo) {
            if (!hasColumnNames) {
                hasColumnNames = true;
                explaininfo["columnnames"] = lineToArray(expLine, explaininfo["columnstarts"]).map(
                    x => x.trim()
                );
            } else {
                explaininfo["rows"][rowNumber] = lineToObj(expLine, explaininfo);
                rowNumber++;
            }
        }
    });
    explainExplain(explaininfo);
}