using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;

class Launcher
{
    static void Main(string[] args)
    {
        string dir = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
        string node = Path.Combine(dir, "bundled-node.exe");
        string app = Path.Combine(dir, "dist", "cli.cjs");

        string allArgs = "\"" + app + "\"";
        for (int i = 0; i < args.Length; i++)
        {
            allArgs += " \"" + args[i].Replace("\"", "\\\"") + "\"";
        }

        ProcessStartInfo psi = new ProcessStartInfo();
        psi.FileName = node;
        psi.Arguments = allArgs;
        psi.UseShellExecute = false;
        psi.WorkingDirectory = dir;
        psi.CreateNoWindow = false;

        Process proc = Process.Start(psi);
        proc.WaitForExit();
        Environment.ExitCode = proc.ExitCode;
    }
}
