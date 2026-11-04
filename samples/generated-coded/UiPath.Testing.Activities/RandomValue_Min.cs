using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（RandomValue_Min）から生成。手で直さず IR を直す
    public class RandomValue_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String path = System.IO.Path.Combine(System.IO.Path.GetTempPath(), "uta-random-value.txt");
            String v = default;
            // 値の一覧を書く
            system.WriteTextFile(text: "color" + Environment.NewLine + "red", file: LocalResource.FromPath(path));
            // 一覧から選ぶ
            v = testing.RandomValue(filePath: path);
            Log(message: Convert.ToString("value=" + v), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
