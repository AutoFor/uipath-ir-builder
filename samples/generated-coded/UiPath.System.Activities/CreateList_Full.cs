using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（CreateList_Full）から生成。手で直さず IR を直す
    public class CreateList_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            IList<Int32> nums = default;
            // 数のリストを作る
            nums = new List<Int32>();
            nums.Add(5);
            Log(message: "count=" + nums.Count.ToString() + ", first=" + nums[0].ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
