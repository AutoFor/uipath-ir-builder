using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（TimeoutScope_Full）から生成。手で直さず IR を直す
    public class TimeoutScope_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            // タイムアウトを受ける
            try
            {
                // 1秒で打ち切る
                // TimeoutScope はCoded API が無い（Coded API なし（時間切れで中の処理を打ち切って例外にする API が無い。Task と CancellationToken で自分で組むことになり、同じ意味の機械的な変換にならない））ので XAML 経由（coded/_xaml/TimeoutScope_Full_1.xaml）
                RunWorkflow("coded/_xaml/TimeoutScope_Full_1.xaml", null);
            }
            catch (Exception exception)
            {
                Log(message: "捕まえた: " + exception.Message, level: UiPath.CodedWorkflows.LogLevel.Info);
            }
            Log(message: "終わり", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
