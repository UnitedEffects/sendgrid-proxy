/**
 * Created by borzou on 9/27/16.
 */

const helpers = {
    sendJson: function(res, output){
        let status;
        if(output.err===null)status=200;
        else status=output.err;
        if(output.message!==null)res.status(status).json({err: output.err, data: output.data, message: output.message});
        else res.status(status).json({err: output.err, data: output.data});
    },
    sendUnauthorized: function(res){
        res.status(401).send('Unauthorized');
    },
    isJson: function(check){
        try {
            JSON.parse(check);
            return true;
        } catch(e) {
            return false;
        }
    }
};

module.exports = helpers;