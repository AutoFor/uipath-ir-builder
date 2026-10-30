using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（Controls）から生成。手で直さず IR を直す
    public class Controls : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Int32 i = 0;
            Int32 total = 0;
            String color = "blue";
            String label = default;
            String text = default;
            List<String> items = new List<String>();
            // 3回まわす
            while (i < 3)
            {
                i = i + 1;
                items.Add("item" + i.ToString());
            }
            // 2回まわす
            do
            {
                total = total + 1;
            } while (total < 2);
            // まとめて代入
            label = "開始";
            color = "red";
            // 色で分ける
            var __switch1 = color;
            if (Equals(__switch1, "red"))
            {
                Log(message: label + ": 赤", level: UiPath.CodedWorkflows.LogLevel.Info);
            }
            else if (Equals(__switch1, "blue"))
            {
                Log(message: label + ": 青", level: UiPath.CodedWorkflows.LogLevel.Info);
            }
            else
            {
                Log(message: "知らない色", level: UiPath.CodedWorkflows.LogLevel.Warn);
            }
            // 例外を捕まえる
            try
            {
                throw new InvalidOperationException("わざと");
            }
            catch (InvalidOperationException ex)
            {
                Log(message: "捕まえた: " + ex.Message, level: UiPath.CodedWorkflows.LogLevel.Warn);
            }
            finally
            {
                Log(message: "finally を通った", level: UiPath.CodedWorkflows.LogLevel.Info);
            }
            system.WriteTextFile(text: String.Join(",", items), file: LocalResource.FromPath("controls-out.txt"));
            text = system.ReadTextFile(file: LocalResource.FromPath("controls-out.txt"));
            Log(message: "ファイルの中身: " + text, level: UiPath.CodedWorkflows.LogLevel.Info);
            // リトライ
            for (var __retry2 = 1; ; __retry2++)
            {
                try
                {
                    Log(message: "リトライの中", level: UiPath.CodedWorkflows.LogLevel.Info);
                    break;
                }
                catch (Exception) when (__retry2 < 2)
                {
                    Delay(TimeSpan.FromMilliseconds(100));
                }
            }
            Delay(time: TimeSpan.FromMilliseconds(100));
            foreach (String it in items)
            {
                if (it == "item2")
                {
                    break;
                }
                else
                {
                    Log(message: "要素: " + it, level: UiPath.CodedWorkflows.LogLevel.Info);
                }
            }
            Log(message: "i=" + i.ToString() + ", total=" + total.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
