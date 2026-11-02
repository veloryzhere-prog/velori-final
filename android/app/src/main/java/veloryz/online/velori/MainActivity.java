package veloryz.online.velori;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(VeloriNotificationsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
