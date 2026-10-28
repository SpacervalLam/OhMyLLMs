using System.Diagnostics;
using System.Runtime.InteropServices;

namespace OhMyLLMs;

internal static class Program
{
    [STAThread]
    private static int Main(string[] args)
    {
        ApplicationConfiguration.Initialize();
        var smokeIndex = Array.IndexOf(args, "--smoke-test");
        var smokeDirectory = smokeIndex >= 0 && smokeIndex + 1 < args.Length
            ? Path.GetFullPath(args[smokeIndex + 1]) : null;
        using var singleton = new Mutex(true, "Local\\OhMyLLMs.Desktop", out var first);
        if (!first && smokeDirectory is null)
        {
            using var current = Process.GetCurrentProcess();
            foreach (var other in Process.GetProcessesByName(current.ProcessName))
            {
                using (other)
                {
                    if (other.Id == current.Id || other.MainWindowHandle == IntPtr.Zero) continue;
                    ShowWindow(other.MainWindowHandle, 9);
                    SetForegroundWindow(other.MainWindowHandle);
                    break;
                }
            }
            return 0;
        }
        using var window = new GameWindow(args.Contains("--dev"), smokeDirectory);
        Application.Run(window);
        return window.ExitCode;
    }

    [DllImport("user32.dll")] private static extern bool SetForegroundWindow(IntPtr window);
    [DllImport("user32.dll")] private static extern bool ShowWindow(IntPtr window, int command);
}
