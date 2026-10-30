using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（LogMessage_Full）から生成。手で直さず IR を直す
    public class LogMessage_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Int32 n = 42;
            // トレース（Information では出ない）
            Log(message: "trace は出ない", level: UiPath.CodedWorkflows.LogLevel.Trace);
            // 情報
            Log(message: "info の行", level: UiPath.CodedWorkflows.LogLevel.Info);
            // 警告
            Log(message: "warn n=" + n.ToString(), level: UiPath.CodedWorkflows.LogLevel.Warn);
            // エラー
            Log(message: "error の行", level: UiPath.CodedWorkflows.LogLevel.Error);
            // 致命
            Log(message: "fatal の行", level: UiPath.CodedWorkflows.LogLevel.Fatal);
            // Object の Message
            Log(message: Convert.ToString(n), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
